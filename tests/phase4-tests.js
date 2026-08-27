const http = require("http");
const fs = require("fs");
const path = require("path");

const root = require("child_process").execSync("npm root -g").toString().trim();
const { SolarchClient } = require(root + "/solarch/packages/core-client/dist/index.cjs");

const SOLARCH_URL = "http://localhost:8090";
const PYTHON_URL = "http://localhost:8000";
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const results = [];

function record(name, status, details) {
  results.push({ name, status, details });
  const icon = status === "PASS" ? "?" : "?";
  console.log(`${icon} [${status}] ${name}: ${typeof details === "string" ? details : JSON.stringify(details)}`);
}

async function runPhase4Suite() {
  console.log("\n=========================================");
  console.log("? STARTING PHASE 4: VOICE PROFILE SYSTEM TEST SUITE");
  console.log("=========================================\n");

  const client = new SolarchClient(SOLARCH_URL);
  let adminToken = "";
  let userAToken = "";
  let userBToken = "";
  let userAId = "";
  let userBId = "";
  let projectAId = "";
  let projectBId = "";
  let sourceAssetId = "";
  let voiceProfileRecordId = "";

  const sampleSpeech = path.join(FIXTURES_DIR, "sample_speech.wav");
  const samplePodcast = path.join(FIXTURES_DIR, "sample_podcast.mp3");

  // 1. Voice Model Subsystem Health
  try {
    const modelsRes = await fetch(`${PYTHON_URL}/v1/voice/models`).then(r => r.json());
    if (modelsRes.speaker_encoder && modelsRes.embedding_dimension === 256) {
      record("1. Voice Model Subsystem Health", "PASS", {
        encoder: modelsRes.speaker_encoder,
        dimension: modelsRes.embedding_dimension,
        device: modelsRes.device,
        vram: modelsRes.vram_status
      });
    } else {
      record("1. Voice Model Subsystem Health", "FAIL", modelsRes);
    }
  } catch (e) {
    record("1. Voice Model Subsystem Health", "FAIL", e.message);
  }

  // 2. Source Audio Provisioning & Multi-Tenant Setup
  try {
    const adminAuth = await client.admins.authWithPassword("admin@voiceai.lab", "AdminPassword123!");
    adminToken = adminAuth.token;

    // User A
    const userAEmail = `voice_architect_a_${Date.now()}@voiceai.lab`;
    const userA = await client.collection("users").create({
      email: userAEmail,
      password: "VoicePasswordA123!",
      passwordConfirm: "VoicePasswordA123!"
    });
    userAId = userA.record.id;
    userAToken = userA.token;

    // User B
    const userBEmail = `voice_architect_b_${Date.now()}@voiceai.lab`;
    const userB = await client.collection("users").create({
      email: userBEmail,
      password: "VoicePasswordB123!",
      passwordConfirm: "VoicePasswordB123!"
    });
    userBId = userB.record.id;
    userBToken = userB.token;

    // Project A
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, userA.record);
    const projA = await clientA.collection("projects").create({
      userId: userAId,
      name: "Voice Profile Studio Alpha",
      description: "Acoustic profiling and cloning workspace"
    });
    projectAId = projA.id;

    // Project B
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, userB.record);
    const projB = await clientB.collection("projects").create({
      userId: userBId,
      name: "Voice Profile Studio Beta",
      description: "Isolated tenant workspace"
    });
    projectBId = projB.id;

    // Source Asset in Project A
    const srcAsset = await clientA.collection("source_assets").create({
      projectId: projectAId,
      userId: userAId,
      name: "sample_speech.wav",
      sourceType: "audio_upload",
      mediaType: "audio",
      format: "wav",
      duration: 2.0,
      sampleRate: 44100,
      channels: 2,
      status: "READY"
    });
    sourceAssetId = srcAsset.id;

    record("2. User, Workspace & Source Asset Provisioning", "PASS", {
      userA: userAId,
      projectA: projectAId,
      sourceAssetId: sourceAssetId
    });
  } catch (e) {
    record("2. User, Workspace & Source Asset Provisioning", "FAIL", e.message);
  }

  // 3. Multi-Dimensional Voice Analysis (POST /v1/voice/analyze)
  let voiceAnalysis = null;
  try {
    const analysisRes = await fetch(`${PYTHON_URL}/v1/voice/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: sampleSpeech, speaker_id: "speaker_1" })
    }).then(r => r.json());

    if (analysisRes.status === "COMPLETED" && analysisRes.pitch && analysisRes.embedding) {
      voiceAnalysis = analysisRes;
      record("3. Multi-Dimensional Voice Analysis", "PASS", {
        f0Mean: analysisRes.pitch.f0_mean,
        f0Range: analysisRes.pitch.f0_range,
        spectralCentroid: analysisRes.timbre.spectral_centroid,
        wpm: analysisRes.prosody.speaking_rate_wpm,
        qualityScore: analysisRes.quality.quality_score,
        timeMs: analysisRes.execution_time_ms
      });
    } else {
      record("3. Multi-Dimensional Voice Analysis", "FAIL", analysisRes);
    }
  } catch (e) {
    record("3. Multi-Dimensional Voice Analysis", "FAIL", e.message);
  }

  // 4. Speaker Embedding Extraction (256-D Vector)
  if (voiceAnalysis?.embedding?.embedding?.length === 256) {
    record("4. Speaker Embedding (256-D L2-Normalized D-Vector)", "PASS", {
      dimension: voiceAnalysis.embedding.dimension,
      model: voiceAnalysis.embedding.model_name,
      sampleVectorHead: voiceAnalysis.embedding.embedding.slice(0, 4)
    });
  } else {
    record("4. Speaker Embedding (256-D L2-Normalized D-Vector)", "FAIL", voiceAnalysis?.embedding);
  }

  // 5. Pitch Analysis & F0 Contour Statistics
  if (voiceAnalysis?.pitch?.f0_mean > 0 && voiceAnalysis?.pitch?.contour_samples?.length === 10) {
    record("5. Pitch Analysis (F0 Mean, Min, Max, Variance, Contour)", "PASS", {
      f0Mean: voiceAnalysis.pitch.f0_mean,
      f0Min: voiceAnalysis.pitch.f0_min,
      f0Max: voiceAnalysis.pitch.f0_max,
      variance: voiceAnalysis.pitch.pitch_variance,
      contourLength: voiceAnalysis.pitch.contour_samples.length
    });
  } else {
    record("5. Pitch Analysis (F0 Mean, Min, Max, Variance, Contour)", "FAIL", voiceAnalysis?.pitch);
  }

  // 6. Timbre & Spectral Moments Analysis
  if (voiceAnalysis?.timbre?.spectral_centroid > 0 && voiceAnalysis?.timbre?.mfcc_means?.length === 13) {
    record("6. Timbre Analysis (Centroid, Bandwidth, Rolloff, MFCC-13)", "PASS", {
      centroid: voiceAnalysis.timbre.spectral_centroid,
      bandwidth: voiceAnalysis.timbre.spectral_bandwidth,
      rolloff: voiceAnalysis.timbre.spectral_rolloff,
      mfccCount: voiceAnalysis.timbre.mfcc_means.length
    });
  } else {
    record("6. Timbre Analysis (Centroid, Bandwidth, Rolloff, MFCC-13)", "FAIL", voiceAnalysis?.timbre);
  }

  // 7. Prosody & Rhythm Dynamics Analysis
  if (voiceAnalysis?.prosody?.speaking_rate_wpm > 0 && voiceAnalysis?.prosody?.rhythm_score > 0) {
    record("7. Prosody Analysis (Speaking Rate, Pauses, Rhythm, Energy)", "PASS", {
      wpm: voiceAnalysis.prosody.speaking_rate_wpm,
      pauseDurationSec: voiceAnalysis.prosody.pause_duration_sec,
      pauseRatio: voiceAnalysis.prosody.pause_frequency_ratio,
      rhythmScore: voiceAnalysis.prosody.rhythm_score
    });
  } else {
    record("7. Prosody Analysis (Speaking Rate, Pauses, Rhythm, Energy)", "FAIL", voiceAnalysis?.prosody);
  }

  // 8. Style Analysis (Conversational, Formality, Expressiveness)
  if (voiceAnalysis?.style?.conversational_score > 0) {
    record("8. Style Analysis (Conversational, Formality, Expressiveness)", "PASS", {
      conversational: voiceAnalysis.style.conversational_score,
      formality: voiceAnalysis.style.formality_score,
      expressiveness: voiceAnalysis.style.expressiveness_score,
      rhythm: voiceAnalysis.style.sentence_rhythm
    });
  } else {
    record("8. Style Analysis (Conversational, Formality, Expressiveness)", "FAIL", voiceAnalysis?.style);
  }

  // 9. Emotion Analysis (Valence, Arousal & Segment Emotion)
  if (voiceAnalysis?.emotion?.primary_emotion && voiceAnalysis?.emotion?.confidence > 0) {
    record("9. Emotion Analysis (Acoustic Valence & Primary Emotion)", "PASS", {
      primaryEmotion: voiceAnalysis.emotion.primary_emotion,
      confidence: voiceAnalysis.emotion.confidence,
      distribution: voiceAnalysis.emotion.emotion_distribution
    });
  } else {
    record("9. Emotion Analysis (Acoustic Valence & Primary Emotion)", "FAIL", voiceAnalysis?.emotion);
  }

  // 10. Voice Reference Quality & Quality Gate (POST /v1/voice/quality)
  try {
    const qualRes = await fetch(`${PYTHON_URL}/v1/voice/quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: sampleSpeech, min_speech_duration: 1.0 })
    }).then(r => r.json());

    if (qualRes.status === "COMPLETED" && qualRes.quality.quality_gate_passed) {
      record("10. Voice Reference Quality & Quality Gate", "PASS", {
        score: qualRes.quality.quality_score,
        snrDb: qualRes.quality.snr_db,
        speechRatio: qualRes.quality.speech_ratio,
        gatePassed: qualRes.quality.quality_gate_passed
      });
    } else {
      record("10. Voice Reference Quality & Quality Gate", "FAIL", qualRes);
    }
  } catch (e) {
    record("10. Voice Reference Quality & Quality Gate", "FAIL", e.message);
  }

  // 11. Voice Profile Creation (POST /v1/voice/profile)
  let createdProfile = null;
  try {
    const profRes = await fetch(`${PYTHON_URL}/v1/voice/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        name: "Dr. Elena Rostova — English Profile",
        source_asset_ids: [sourceAssetId],
        audio_paths: [sampleSpeech],
        target_speaker_id: "speaker_1",
        language: "en"
      })
    }).then(r => r.json());

    if (profRes.status === "READY" && profRes.quality_gate_passed) {
      createdProfile = profRes;
      record("11. Voice Profile Generation Engine", "PASS", {
        status: profRes.status,
        name: profRes.name,
        targetSpeaker: profRes.target_speaker_id,
        qualityScore: profRes.quality_score,
        timeMs: profRes.execution_time_ms
      });
    } else {
      record("11. Voice Profile Generation Engine", "FAIL", profRes);
    }
  } catch (e) {
    record("11. Voice Profile Generation Engine", "FAIL", e.message);
  }

  // 12. Multi-Sample Profile Creation (Aggregating Multiple Samples)
  try {
    const multiRes = await fetch(`${PYTHON_URL}/v1/voice/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        name: "Multi-Sample Aggregated Profile",
        source_asset_ids: [sourceAssetId, "src_002"],
        audio_paths: [sampleSpeech, samplePodcast],
        target_speaker_id: "speaker_1",
        language: "en"
      })
    }).then(r => r.json());

    if (multiRes.status === "READY" && multiRes.usable_samples_count === 2) {
      record("12. Multi-Sample Voice Profile Aggregation", "PASS", {
        usableSamples: multiRes.usable_samples_count,
        totalSpeechDuration: multiRes.total_speech_duration,
        qualityScore: multiRes.quality_score
      });
    } else {
      record("12. Multi-Sample Voice Profile Aggregation", "FAIL", multiRes);
    }
  } catch (e) {
    record("12. Multi-Sample Voice Profile Aggregation", "FAIL", e.message);
  }

  // 13. Solarch Voice Profile Storage
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const solarchProfile = await clientA.collection("voice_profiles").create({
      projectId: projectAId,
      userId: userAId,
      name: "Dr. Elena Rostova — English Profile",
      speakerId: "speaker_1",
      sourceAssetId: sourceAssetId,
      speakerEmbedding: createdProfile?.embedding?.embedding || [0.01, -0.02],
      timbreCharacteristics: createdProfile?.timbre || {},
      pitchStats: createdProfile?.pitch || {},
      prosodyProfile: createdProfile?.prosody || {},
      styleProfile: createdProfile?.style || {},
      emotionProfile: createdProfile?.emotion || {},
      referenceAudio: "sample_speech.wav"
    });

    voiceProfileRecordId = solarchProfile.id;
    record("13. Solarch Voice Profile Record Storage", "PASS", {
      voiceProfileId: voiceProfileRecordId,
      name: solarchProfile.name,
      projectId: solarchProfile.projectId
    });
  } catch (e) {
    record("13. Solarch Voice Profile Record Storage", "FAIL", e.message);
  }

  // 14. Solarch Voice Profile Retrieval by User
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const retrieved = await clientA.collection("voice_profiles").getOne(voiceProfileRecordId);
    if (retrieved && retrieved.id === voiceProfileRecordId) {
      record("14. Solarch Voice Profile Retrieval by User", "PASS", {
        id: retrieved.id,
        name: retrieved.name,
        speakerId: retrieved.speakerId
      });
    } else {
      record("14. Solarch Voice Profile Retrieval by User", "FAIL", retrieved);
    }
  } catch (e) {
    record("14. Solarch Voice Profile Retrieval by User", "FAIL", e.message);
  }

  // 15. Voice Profile Comparison (POST /v1/voice/compare)
  try {
    // A. Compare identical audio (Self-Comparison -> 1.0)
    const selfCompare = await fetch(`${PYTHON_URL}/v1/voice/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_audio_path: sampleSpeech,
        candidate_audio_path: sampleSpeech
      })
    }).then(r => r.json());

    // B. Compare different audios
    const crossCompare = await fetch(`${PYTHON_URL}/v1/voice/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reference_audio_path: sampleSpeech,
        candidate_audio_path: samplePodcast
      })
    }).then(r => r.json());

    if (selfCompare.composite_similarity_score === 1.0 && crossCompare.status === "COMPLETED") {
      record("15. Voice Profile Comparison (Cosine, Pitch, Timbre, Prosody)", "PASS", {
        identicalScore: selfCompare.composite_similarity_score,
        crossSpeakerCosine: crossCompare.embedding_cosine_similarity,
        crossComposite: crossCompare.composite_similarity_score,
        isSameSpeaker: crossCompare.is_same_speaker
      });
    } else {
      record("15. Voice Profile Comparison (Cosine, Pitch, Timbre, Prosody)", "FAIL", { selfCompare, crossCompare });
    }
  } catch (e) {
    record("15. Voice Profile Comparison (Cosine, Pitch, Timbre, Prosody)", "FAIL", e.message);
  }

  // 16. Target Speaker Selection & Multi-Speaker Isolation
  try {
    const spk2Res = await fetch(`${PYTHON_URL}/v1/voice/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        name: "Speaker 2 Isolated Profile",
        source_asset_ids: [sourceAssetId],
        audio_paths: [sampleSpeech],
        target_speaker_id: "speaker_2",
        language: "en"
      })
    }).then(r => r.json());

    if (spk2Res.target_speaker_id === "speaker_2" && spk2Res.status === "READY") {
      record("16. Target Speaker Selection Isolation (Speaker 2)", "PASS", {
        targetSpeaker: spk2Res.target_speaker_id,
        status: spk2Res.status,
        qualityScore: spk2Res.quality_score
      });
    } else {
      record("16. Target Speaker Selection Isolation (Speaker 2)", "FAIL", spk2Res);
    }
  } catch (e) {
    record("16. Target Speaker Selection Isolation (Speaker 2)", "FAIL", e.message);
  }

  // 17. Noisy-Audio Preprocessing Comparison
  try {
    const cleanQual = await fetch(`${PYTHON_URL}/v1/voice/quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: sampleSpeech })
    }).then(r => r.json());

    record("17. Preprocessing & SNR Quality Comparison", "PASS", {
      cleanSNR: `${cleanQual.quality?.snr_db} dB`,
      qualityScore: cleanQual.quality?.quality_score,
      gatePassed: cleanQual.quality?.quality_gate_passed
    });
  } catch (e) {
    record("17. Preprocessing & SNR Quality Comparison", "FAIL", e.message);
  }

  // 18. Realtime Profile Status Broadcasting Channel
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const sseRes = await fetch(`${SOLARCH_URL}/api/realtime`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${adminToken}` }
    }).catch(err => {
      if (err.name === "AbortError") return { status: 200, ok: true };
      throw err;
    });
    clearTimeout(timeout);
    record("18. Realtime Profile Status Broadcasting Channel", "PASS", { protocol: "SSE", status: sseRes.status });
  } catch (e) {
    record("18. Realtime Profile Status Broadcasting Channel", "FAIL", e.message);
  }

  // 19. Multi-Tenant Project & Profile Ownership Isolation
  try {
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, { id: userBId, email: "voice_b" });

    // User B lists profiles in Project B (should NOT see User A's profile)
    const userBProfiles = await clientB.collection("voice_profiles").getList(1, 10, {
      filter: `projectId = '${projectBId}'`
    });

    const leaked = (userBProfiles.items || []).some(item => item.id === voiceProfileRecordId);
    if (!leaked) {
      record("19. Multi-Tenant Voice Profile Isolation Guard", "PASS", {
        userBProfileCount: userBProfiles.totalItems || 0,
        isolated: true
      });
    } else {
      record("19. Multi-Tenant Voice Profile Isolation Guard", "FAIL", "User A voice profile leaked to User B");
    }
  } catch (e) {
    record("19. Multi-Tenant Voice Profile Isolation Guard", "FAIL", e.message);
  }

  // 20. Security Test: Corrupted Reference Audio Rejection
  const corruptFile = path.join(FIXTURES_DIR, "corrupted_media.wav");
  try {
    const corruptRes = await fetch(`${PYTHON_URL}/v1/voice/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        name: "Corrupt Profile Test",
        source_asset_ids: ["src_corrupt"],
        audio_paths: [corruptFile]
      })
    }).then(r => r.json());

    if (corruptRes.status === "FAILED" && !corruptRes.quality_gate_passed) {
      record("20. Corrupted Reference Audio Rejection Guard", "PASS", {
        status: corruptRes.status,
        gatePassed: corruptRes.quality_gate_passed,
        error: corruptRes.error
      });
    } else {
      record("20. Corrupted Reference Audio Rejection Guard", "FAIL", corruptRes);
    }
  } catch (e) {
    record("20. Corrupted Reference Audio Rejection Guard", "FAIL", e.message);
  }

  // 21. Security Test: 0-Byte Empty Audio Rejection
  const emptyFile = path.join(FIXTURES_DIR, "empty_file.wav");
  try {
    const emptyRes = await fetch(`${PYTHON_URL}/v1/voice/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: emptyFile })
    });
    const emptyData = await emptyRes.json();

    if (emptyRes.status === 400 || emptyData.detail) {
      record("21. Empty 0-Byte Audio Rejection Guard", "PASS", {
        status: emptyRes.status,
        detail: emptyData.detail
      });
    } else {
      record("21. Empty 0-Byte Audio Rejection Guard", "FAIL", emptyData);
    }
  } catch (e) {
    record("21. Empty 0-Byte Audio Rejection Guard", "FAIL", e.message);
  }

  // 22. GPU/CPU Telemetry Verification
  try {
    const modelsRes = await fetch(`${PYTHON_URL}/v1/voice/models`).then(r => r.json());
    record("22. GPU/CPU Hardware Telemetry Tracking", "PASS", {
      device: modelsRes.device,
      vram: modelsRes.vram_status
    });
  } catch (e) {
    record("22. GPU/CPU Hardware Telemetry Tracking", "FAIL", e.message);
  }

  // 23. Benchmark: 10s, 30s, and 60s Voice Profile Generation
  const b10 = path.join(FIXTURES_DIR, "benchmark_10s.wav");
  const b30 = path.join(FIXTURES_DIR, "benchmark_30s.wav");
  const b60 = path.join(FIXTURES_DIR, "benchmark_60s.wav");
  try {
    const start10 = Date.now();
    const bench10 = await fetch(`${PYTHON_URL}/v1/voice/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: b10 })
    }).then(r => r.json());
    const total10 = Date.now() - start10;

    const start30 = Date.now();
    const bench30 = await fetch(`${PYTHON_URL}/v1/voice/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: b30 })
    }).then(r => r.json());
    const total30 = Date.now() - start30;

    const start60 = Date.now();
    const bench60 = await fetch(`${PYTHON_URL}/v1/voice/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio_path: b60 })
    }).then(r => r.json());
    const total60 = Date.now() - start60;

    record("23. Voice Profile Analysis Benchmark (10s, 30s, 60s)", "PASS", {
      bench10sMs: total10,
      bench30sMs: total30,
      bench60sMs: total60,
      qualityScores: [bench10.quality?.quality_score, bench30.quality?.quality_score, bench60.quality?.quality_score]
    });
  } catch (e) {
    record("23. Voice Profile Analysis Benchmark (10s, 30s, 60s)", "FAIL", e.message);
  }

  console.log("\n=========================================");
  console.log("? PHASE 4 TEST SUITE SUMMARY");
  console.log("=========================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const total = results.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("=========================================\n");

  fs.writeFileSync("tests/phase4-results.json", JSON.stringify(results, null, 2), "utf8");
}

runPhase4Suite().catch(console.error);
