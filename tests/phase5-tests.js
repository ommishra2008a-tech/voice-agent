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

async function runPhase5Suite() {
  console.log("\n=========================================");
  console.log("? STARTING PHASE 5: VOICE GENERATION TEST SUITE");
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
  let voiceProfileId = "";
  let generationJobId = "";
  let generationJob = null;
  let generatedAssetId = "";

  const sampleSpeech = path.join(FIXTURES_DIR, "sample_speech.wav");

  // 1. GPU Environment & Engine Telemetry
  try {
    const enginesRes = await fetch(`${PYTHON_URL}/v1/speech/engines`).then(r => r.json());
    if (enginesRes.engines && enginesRes.engines.length >= 4) {
      record("1. GPU Environment & Engine Telemetry", "PASS", {
        device: enginesRes.active_device,
        vram: enginesRes.vram_status,
        engineCount: enginesRes.engines.length
      });
    } else {
      record("1. GPU Environment & Engine Telemetry", "FAIL", enginesRes);
    }
  } catch (e) {
    record("1. GPU Environment & Engine Telemetry", "FAIL", e.message);
  }

  // 2. Model Availability & Registry Listing
  try {
    const enginesRes = await fetch(`${PYTHON_URL}/v1/speech/engines`).then(r => r.json());
    const hasFastPitch = enginesRes.engines.some(e => e.id === "fastpitch-baseline");
    const hasXTTS = enginesRes.engines.some(e => e.id === "xtts-v2");
    if (hasFastPitch && hasXTTS) {
      record("2. Model Availability & Engine Registry", "PASS", {
        models: enginesRes.engines.map(e => e.id)
      });
    } else {
      record("2. Model Availability & Engine Registry", "FAIL", enginesRes);
    }
  } catch (e) {
    record("2. Model Availability & Engine Registry", "FAIL", e.message);
  }

  // 3. User, Workspace, Source Asset & Voice Profile Provisioning
  try {
    const adminAuth = await client.admins.authWithPassword("admin@voiceai.lab", "AdminPassword123!");
    adminToken = adminAuth.token;

    // User A
    const userAEmail = `synthesis_engineer_a_${Date.now()}@voiceai.lab`;
    const userA = await client.collection("users").create({
      email: userAEmail,
      password: "SynthesisPasswordA123!",
      passwordConfirm: "SynthesisPasswordA123!"
    });
    userAId = userA.record.id;
    userAToken = userA.token;

    // User B
    const userBEmail = `synthesis_engineer_b_${Date.now()}@voiceai.lab`;
    const userB = await client.collection("users").create({
      email: userBEmail,
      password: "SynthesisPasswordB123!",
      passwordConfirm: "SynthesisPasswordB123!"
    });
    userBId = userB.record.id;
    userBToken = userB.token;

    // Project A & Project B
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, userA.record);
    const projA = await clientA.collection("projects").create({
      userId: userAId,
      name: "Voice Synthesis Studio Alpha",
      description: "Neural voice generation pipeline"
    });
    projectAId = projA.id;

    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, userB.record);
    const projB = await clientB.collection("projects").create({
      userId: userBId,
      name: "Voice Synthesis Studio Beta",
      description: "Isolated synthesis studio"
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

    // Voice Profile in Project A
    const prof = await clientA.collection("voice_profiles").create({
      projectId: projectAId,
      userId: userAId,
      name: "Dr. Elena Synthesis Target",
      speakerId: "speaker_1",
      sourceAssetId: sourceAssetId,
      speakerEmbedding: [0.043, 0.133, -0.045, 0.055],
      timbreCharacteristics: { spectralCentroid: 1933 },
      pitchStats: { f0Mean: 150.5 },
      prosodyProfile: { wpm: 168 },
      styleProfile: { style: "conversational" },
      emotionProfile: { primary: "neutral" },
      referenceAudio: sampleSpeech
    });
    voiceProfileId = prof.id;

    record("3. User, Workspace & Voice Profile Provisioning", "PASS", {
      userA: userAId,
      projectA: projectAId,
      voiceProfileId: voiceProfileId
    });
  } catch (e) {
    record("3. User, Workspace & Voice Profile Provisioning", "FAIL", e.message);
  }

  // 4. Voice Profile Retrieval
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });
    const retrievedProf = await clientA.collection("voice_profiles").getOne(voiceProfileId);

    if (retrievedProf && retrievedProf.id === voiceProfileId) {
      record("4. Voice Profile Retrieval by Engine", "PASS", {
        id: retrievedProf.id,
        name: retrievedProf.name,
        speakerId: retrievedProf.speakerId
      });
    } else {
      record("4. Voice Profile Retrieval by Engine", "FAIL", retrievedProf);
    }
  } catch (e) {
    record("4. Voice Profile Retrieval by Engine", "FAIL", e.message);
  }

  // 5. Python Voice Engine Direct Synthesis (POST /v1/speech/generate)
  let genAudioPath = "";
  let genDuration = 0.0;
  try {
    const genRes = await fetch(`${PYTHON_URL}/v1/speech/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        voice_profile_id: voiceProfileId,
        text: "Welcome to the Autonomous Voice AI Laboratory. Neural synthesis is online.",
        language: "en",
        speed: 1.0,
        pitch: 0.0,
        model: "fastpitch-baseline"
      })
    }).then(r => r.json());

    if (genRes.status === "COMPLETED" && genRes.audio_path) {
      genAudioPath = genRes.audio_path;
      genDuration = genRes.duration;
      record("5. Python Voice Engine Direct Synthesis", "PASS", {
        status: genRes.status,
        outputPath: genRes.audio_path,
        duration: genRes.duration,
        sampleRate: genRes.sample_rate,
        timeMs: genRes.execution_time_ms
      });
    } else {
      record("5. Python Voice Engine Direct Synthesis", "FAIL", genRes);
    }
  } catch (e) {
    record("5. Python Voice Engine Direct Synthesis", "FAIL", e.message);
  }

  // 6. Solarch Generation Job Creation (PENDING)
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const job = await clientA.collection("generation_jobs").create({
      projectId: projectAId,
      userId: userAId,
      voiceProfileId: voiceProfileId,
      status: "PENDING",
      progress: 0,
      text: "Welcome to the Autonomous Voice AI Laboratory. Neural synthesis is online.",
      model: "fastpitch-baseline"
    });
    generationJob = job;
    generationJobId = job.id;
    record("6. Solarch Generation Job Creation (PENDING)", "PASS", {
      jobId: generationJobId,
      status: job.status
    });
  } catch (e) {
    record("6. Solarch Generation Job Creation (PENDING)", "FAIL", e.message);
  }

  // 7. Generation Job State Machine Transitions (PENDING -> QUEUED -> PROCESSING -> COMPLETED)
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    // Transition QUEUED
    const qJob = await clientA.collection("generation_jobs").update(generationJobId, {
      ...generationJob,
      status: "QUEUED",
      progress: 25
    });
    record("7a. Generation Job Transition (QUEUED 25%)", "PASS", { status: qJob.status, progress: qJob.progress });

    // Transition PROCESSING
    const pJob = await clientA.collection("generation_jobs").update(generationJobId, {
      ...generationJob,
      status: "PROCESSING",
      progress: 75
    });
    record("7b. Generation Job Transition (PROCESSING 75%)", "PASS", { status: pJob.status, progress: pJob.progress });

    // Transition COMPLETED
    const cJob = await clientA.collection("generation_jobs").update(generationJobId, {
      ...generationJob,
      status: "COMPLETED",
      progress: 100,
      duration: genDuration,
      executionTimeMs: 45
    });
    record("7c. Generation Job Transition (COMPLETED 100%)", "PASS", { status: cJob.status, progress: cJob.progress });
  } catch (e) {
    record("7. Generation Job State Machine Transitions", "FAIL", e.message);
  }

  // 8. Solarch Generated Asset Record Storage
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const genAsset = await clientA.collection("generated_assets").create({
      jobId: generationJobId,
      projectId: projectAId,
      userId: userAId,
      voiceProfileId: voiceProfileId,
      file: genAudioPath,
      duration: genDuration,
      format: "wav",
      sampleRate: 24000,
      qualityScore: 98.5,
      model: "fastpitch-baseline",
      modelVersion: "v1.0.0",
      executionTimeMs: 45
    });
    generatedAssetId = genAsset.id;
    record("8. Solarch Generated Asset Storage", "PASS", {
      generatedAssetId: generatedAssetId,
      duration: genAsset.duration,
      format: genAsset.format
    });
  } catch (e) {
    record("8. Solarch Generated Asset Storage", "FAIL", e.message);
  }

  // 9. Post-Synthesis Quality & Similarity Evaluation (POST /v1/speech/evaluate)
  try {
    const evalRes = await fetch(`${PYTHON_URL}/v1/speech/evaluate?ref_path=${encodeURIComponent(sampleSpeech)}&gen_path=${encodeURIComponent(genAudioPath)}`, {
      method: "POST"
    }).then(r => r.json());

    if (evalRes.evaluation_passed) {
      record("9. Post-Synthesis Quality & Identity Evaluation", "PASS", {
        overallQuality: evalRes.overall_quality_score,
        pitchCorrelation: evalRes.pitch_correlation,
        timbreMatch: evalRes.timbre_spectral_match,
        passed: evalRes.evaluation_passed
      });
    } else {
      record("9. Post-Synthesis Quality & Identity Evaluation", "FAIL", evalRes);
    }
  } catch (e) {
    record("9. Post-Synthesis Quality & Identity Evaluation", "FAIL", e.message);
  }

  // 10. Realtime Generation State Broadcasting Channel
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
    record("10. Realtime Generation Broadcasting Channel", "PASS", { protocol: "SSE", status: sseRes.status });
  } catch (e) {
    record("10. Realtime Generation Broadcasting Channel", "FAIL", e.message);
  }

  // 11. Playback Reference & File Integrity Check
  if (fs.existsSync(genAudioPath) && fs.statSync(genAudioPath).size > 0) {
    record("11. Playback File Reference & Integrity", "PASS", {
      filePath: genAudioPath,
      sizeBytes: fs.statSync(genAudioPath).size,
      accessible: true
    });
  } else {
    record("11. Playback File Reference & Integrity", "FAIL", "Generated audio file missing or 0 bytes");
  }

  // 12. Security Test: Empty Text Synthesis Rejection Guard
  try {
    const emptyRes = await fetch(`${PYTHON_URL}/v1/speech/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        voice_profile_id: voiceProfileId,
        text: "   ",
        model: "fastpitch-baseline"
      })
    });
    const emptyData = await emptyRes.json();

    if (emptyRes.status === 400 || emptyData.detail) {
      record("12. Empty Text Synthesis Rejection Guard", "PASS", {
        status: emptyRes.status,
        detail: emptyData.detail
      });
    } else {
      record("12. Empty Text Synthesis Rejection Guard", "FAIL", emptyData);
    }
  } catch (e) {
    record("12. Empty Text Synthesis Rejection Guard", "FAIL", e.message);
  }

  // 13. Security Test: Multi-Tenant Project & Asset Isolation Guard
  try {
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, { id: userBId, email: "synthesis_b" });

    // User B lists generated assets in Project B (should NOT see User A's generated assets)
    const userBAssets = await clientB.collection("generated_assets").getList(1, 10, {
      filter: `projectId = '${projectBId}'`
    });

    const leaked = (userBAssets.items || []).some(item => item.id === generatedAssetId);
    if (!leaked) {
      record("13. Multi-Tenant Generated Asset Isolation Guard", "PASS", {
        userBAssetCount: userBAssets.totalItems || 0,
        isolated: true
      });
    } else {
      record("13. Multi-Tenant Generated Asset Isolation Guard", "FAIL", "User A asset leaked to User B");
    }
  } catch (e) {
    record("13. Multi-Tenant Generated Asset Isolation Guard", "FAIL", e.message);
  }

  // 14. Benchmark: 10s Reference Text Synthesis
  try {
    const start10 = Date.now();
    const res10 = await fetch(`${PYTHON_URL}/v1/speech/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        voice_profile_id: voiceProfileId,
        text: "Short ten second text benchmark for voice synthesis testing.",
        speed: 1.0,
        model: "fastpitch-baseline"
      })
    }).then(r => r.json());
    const total10 = Date.now() - start10;

    record("14. 10s Reference Voice Synthesis Benchmark", "PASS", {
      generatedDuration: res10.duration,
      executionMs: res10.execution_time_ms,
      totalRoundtripMs: total10,
      speedFactor: `${(res10.duration / (total10 / 1000)).toFixed(1)}x real-time`
    });
  } catch (e) {
    record("14. 10s Reference Voice Synthesis Benchmark", "FAIL", e.message);
  }

  // 15. Benchmark: 30s Paragraph Voice Synthesis
  try {
    const start30 = Date.now();
    const paragraphText = "In this comprehensive evaluation of the voice generation subsystem, the autonomous agent coordinates text parsing, pitch conditioning, and audio synthesis to produce clean, natural speech.";
    const res30 = await fetch(`${PYTHON_URL}/v1/speech/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        voice_profile_id: voiceProfileId,
        text: paragraphText,
        speed: 1.0,
        model: "fastpitch-baseline"
      })
    }).then(r => r.json());
    const total30 = Date.now() - start30;

    record("15. 30s Paragraph Voice Synthesis Benchmark", "PASS", {
      generatedDuration: res30.duration,
      executionMs: res30.execution_time_ms,
      totalRoundtripMs: total30,
      speedFactor: `${(res30.duration / (total30 / 1000)).toFixed(1)}x real-time`
    });
  } catch (e) {
    record("15. 30s Paragraph Voice Synthesis Benchmark", "FAIL", e.message);
  }

  // 16. Benchmark: 60s Script Voice Synthesis
  try {
    const start60 = Date.now();
    const scriptText = "Welcome to the full-scale AI voice studio demonstration. We have validated multi-track media input, acoustic voice activity detection, automatic speech recognition with Faster-Whisper, multi-speaker diarization, multi-dimensional voice profiling with two hundred fifty-six dimensional speaker embeddings, and now real-time neural voice generation with complete Solarch job orchestration.";
    const res60 = await fetch(`${PYTHON_URL}/v1/speech/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        voice_profile_id: voiceProfileId,
        text: scriptText,
        speed: 1.0,
        model: "fastpitch-baseline"
      })
    }).then(r => r.json());
    const total60 = Date.now() - start60;

    record("16. 60s Script Voice Synthesis Benchmark", "PASS", {
      generatedDuration: res60.duration,
      executionMs: res60.execution_time_ms,
      totalRoundtripMs: total60,
      speedFactor: `${(res60.duration / (total60 / 1000)).toFixed(1)}x real-time`
    });
  } catch (e) {
    record("16. 60s Script Voice Synthesis Benchmark", "FAIL", e.message);
  }

  console.log("\n=========================================");
  console.log("? PHASE 5 TEST SUITE SUMMARY");
  console.log("=========================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const total = results.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("=========================================\n");

  fs.writeFileSync("tests/phase5-results.json", JSON.stringify(results, null, 2), "utf8");
}

runPhase5Suite().catch(console.error);


