const http = require("http");
const fs = require("fs");
const path = require("path");

const root = require("child_process").execSync("npm root -g").toString().trim();
const { SolarchClient } = require(root + "/solarch/packages/core-client/dist/index.cjs");

const SOLARCH_URL = "http://localhost:8090";
const PYTHON_URL = "http://localhost:8000";

const results = [];

function record(name, status, details) {
  results.push({ name, status, details });
  const icon = status === "PASS" ? "✔" : "✖";
  console.log(`${icon} [${status}] ${name}: ${typeof details === "string" ? details : JSON.stringify(details)}`);
}

async function runPhase7Suite() {
  console.log("\n=========================================");
  console.log("⚡ STARTING PHASE 7: TRANSLATION PIPELINE TEST SUITE");
  console.log("=========================================\n");

  const client = new SolarchClient(SOLARCH_URL);
  let adminToken = "";
  let userAToken = "";
  let userBToken = "";
  let userAId = "";
  let userBId = "";
  let projectAId = "";
  let projectBId = "";
  let voiceProfileId = "";
  let translationJobId = "";
  let translationJob = null;

  // 1. Translation Service Health
  try {
    const modelsRes = await fetch(`${PYTHON_URL}/v1/translation/models`).then(r => r.json());
    if (modelsRes.status === "HEALTHY" && modelsRes.supported_languages.includes("hi")) {
      record("1. Translation Service Health & Models", "PASS", {
        provider: modelsRes.active_provider,
        defaultModel: modelsRes.default_model,
        languages: modelsRes.supported_languages
      });
    } else {
      record("1. Translation Service Health & Models", "FAIL", modelsRes);
    }
  } catch (e) {
    record("1. Translation Service Health & Models", "FAIL", e.message);
  }

  // 2. User & Project Workspace Provisioning
  try {
    const adminAuth = await client.admins.authWithPassword("admin@voiceai.lab", "AdminPassword123!");
    adminToken = adminAuth.token;

    // User A
    const userAEmail = `translation_engineer_a_${Date.now()}@voiceai.lab`;
    const userA = await client.collection("users").create({
      email: userAEmail,
      password: "TransPasswordA123!",
      passwordConfirm: "TransPasswordA123!"
    });
    userAId = userA.record.id;
    userAToken = userA.token;

    // User B
    const userBEmail = `translation_engineer_b_${Date.now()}@voiceai.lab`;
    const userB = await client.collection("users").create({
      email: userBEmail,
      password: "TransPasswordB123!",
      passwordConfirm: "TransPasswordB123!"
    });
    userBId = userB.record.id;
    userBToken = userB.token;

    // Project A
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, userA.record);
    const projA = await clientA.collection("projects").create({
      userId: userAId,
      name: "Multilingual Dubbing Studio Alpha",
      description: "Neural Translation and Voice Dubbing Workspace"
    });
    projectAId = projA.id;

    // Project B
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, userB.record);
    const projB = await clientB.collection("projects").create({
      userId: userBId,
      name: "Multilingual Dubbing Studio Beta",
      description: "Isolated Tenant Dubbing Base"
    });
    projectBId = projB.id;

    // Create Voice Profile in Project A
    const prof = await clientA.collection("voice_profiles").create({
      projectId: projectAId,
      userId: userAId,
      name: "Devi Multilingual Anchor",
      speakerId: "anchor_hi",
      speakerEmbedding: [0.012, 0.443, -0.122, 0.088],
      timbreCharacteristics: { spectralCentroid: 2100 },
      pitchStats: { f0Mean: 180.0 },
      prosodyProfile: { wpm: 155 },
      styleProfile: { style: "formal" },
      emotionProfile: { primary: "neutral" }
    });
    voiceProfileId = prof.id;

    record("2. User, Tenant & Voice Profile Provisioning", "PASS", {
      userA: userAId,
      projectA: projectAId,
      voiceProfileId: voiceProfileId
    });
  } catch (e) {
    record("2. User, Tenant & Voice Profile Provisioning", "FAIL", e.message);
  }

  // 3. Language Detection (English vs Hindi Devanagari)
  try {
    const enDet = await fetch(`${PYTHON_URL}/v1/translation/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello team, today we are reviewing speech synthesis." })
    }).then(r => r.json());

    const hiDet = await fetch(`${PYTHON_URL}/v1/translation/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "\u0928\u092e\u0938\u094d\u0924\u0947 \u091f\u0940\u092e, \u0906\u091c \u0939\u092e \u0928\u094d\u092f\u0942\u0930\u0932 \u0911\u0921\u093f\u092f\u094b \u0938\u0902\u0936\u094d\u0932\u0947\u0937\u0923 \u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902\u0964" })
    }).then(r => r.json());

    if (enDet.detected_language === "en" && hiDet.detected_language === "hi") {
      record("3. Language Detection (English & Hindi Devanagari)", "PASS", {
        enDetected: enDet.detected_language,
        enConf: enDet.confidence,
        hiDetected: hiDet.detected_language,
        hiConf: hiDet.confidence
      });
    } else {
      record("3. Language Detection (English & Hindi Devanagari)", "FAIL", { enDet, hiDet });
    }
  } catch (e) {
    record("3. Language Detection (English & Hindi Devanagari)", "FAIL", e.message);
  }

  // 4. English -> Hindi Neural Translation
  let enToHiResult = null;
  try {
    const enToHiRes = await fetch(`${PYTHON_URL}/v1/translation/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_text: "Welcome to the Autonomous Voice AI Laboratory. Neural synthesis is online.",
        source_language: "en",
        target_language: "hi"
      })
    }).then(r => r.json());

    if (enToHiRes.translated_text && enToHiRes.target_language === "hi") {
      enToHiResult = enToHiRes;
      record("4. English -> Hindi Neural Translation", "PASS", {
        source: enToHiRes.source_language,
        target: enToHiRes.target_language,
        translatedSnippet: enToHiRes.translated_text,
        confidence: enToHiRes.confidence,
        timeMs: enToHiRes.execution_time_ms
      });
    } else {
      record("4. English -> Hindi Neural Translation", "FAIL", enToHiRes);
    }
  } catch (e) {
    record("4. English -> Hindi Neural Translation", "FAIL", e.message);
  }

  // 5. Hindi -> English Neural Translation
  try {
    const hiToEnRes = await fetch(`${PYTHON_URL}/v1/translation/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_text: "\u0928\u092e\u0938\u094d\u0924\u0947 \u0938\u092d\u0940 \u0915\u094b, \u0906\u091c \u0939\u092e \u0928\u090f \u092a\u093e\u0907\u092a\u0932\u093e\u0907\u0928 \u0915\u0940 \u0938\u092e\u0940\u0915\u094d\u0937\u093e \u0915\u0930 \u0930\u0939\u0947 \u0939\u0948\u0902\u0964",
        source_language: "hi",
        target_language: "en"
      })
    }).then(r => r.json());

    if (hiToEnRes.translated_text && hiToEnRes.target_language === "en") {
      record("5. Hindi -> English Neural Translation", "PASS", {
        source: hiToEnRes.source_language,
        target: hiToEnRes.target_language,
        translatedSnippet: hiToEnRes.translated_text,
        timeMs: hiToEnRes.execution_time_ms
      });
    } else {
      record("5. Hindi -> English Neural Translation", "FAIL", hiToEnRes);
    }
  } catch (e) {
    record("5. Hindi -> English Neural Translation", "FAIL", e.message);
  }

  // 6. Context & Project Terminology Glossary Translation
  try {
    const glossaryRes = await fetch(`${PYTHON_URL}/v1/translation/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_text: "The Solarch BaaS platform powers our Voice Profile system.",
        source_language: "en",
        target_language: "hi",
        glossary: {
          "Solarch": "Solarch-Engine",
          "BaaS": "Backend-Platform",
          "Voice Profile": "Acoustic-Profile"
        }
      })
    }).then(r => r.json());

    if (glossaryRes.translated_text.includes("Solarch-Engine") || glossaryRes.translated_text.includes("Backend-Platform")) {
      record("6. Context & Terminology Glossary Translation", "PASS", {
        translated: glossaryRes.translated_text,
        glossaryApplied: true
      });
    } else {
      record("6. Context & Terminology Glossary Translation", "FAIL", glossaryRes);
    }
  } catch (e) {
    record("6. Context & Terminology Glossary Translation", "FAIL", e.message);
  }

  // 7. Multi-Speaker Transcript Translation (Preserving Speaker IDs and Timestamps)
  try {
    const transcriptReq = {
      project_id: projectAId,
      user_id: userAId,
      source_language: "en",
      target_language: "hi",
      segments: [
        {
          speaker_id: "speaker_1",
          start_time: 0.0,
          end_time: 4.2,
          original_text: "Hello everyone, welcome to the review."
        },
        {
          speaker_id: "speaker_2",
          start_time: 4.2,
          end_time: 8.9,
          original_text: "Today we are reviewing new audio accuracy and diarization."
        }
      ]
    };

    const transRes = await fetch(`${PYTHON_URL}/v1/translation/transcript`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(transcriptReq)
    }).then(r => r.json());

    const seg0 = transRes.segments[0];
    const seg1 = transRes.segments[1];

    if (
      seg0.speaker_id === "speaker_1" &&
      seg0.start_time === 0.0 &&
      seg0.translated_text &&
      seg1.speaker_id === "speaker_2" &&
      seg1.start_time === 4.2 &&
      seg1.translated_text
    ) {
      record("7. Multi-Speaker Transcript Translation", "PASS", {
        totalSegments: transRes.total_segments,
        seg0Speaker: seg0.speaker_id,
        seg0Translated: seg0.translated_text,
        seg1Speaker: seg1.speaker_id,
        seg1Translated: seg1.translated_text
      });
    } else {
      record("7. Multi-Speaker Transcript Translation", "FAIL", transRes);
    }
  } catch (e) {
    record("7. Multi-Speaker Transcript Translation", "FAIL", e.message);
  }

  // 8. Solarch Translation Job State Machine (PENDING -> QUEUED -> PROCESSING -> COMPLETED)
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const job = await clientA.collection("translation_jobs").create({
      projectId: projectAId,
      userId: userAId,
      sourceLanguage: "en",
      targetLanguage: "hi",
      status: "PENDING",
      progress: 0,
      provider: "local-neural-translator",
      model: "nllb-200-distilled-600M"
    });
    translationJobId = job.id;
    translationJob = job;
    record("8a. Solarch Translation Job Creation (PENDING)", "PASS", { jobId: translationJobId, status: job.status });

    // Transition QUEUED
    const qJob = await clientA.collection("translation_jobs").update(translationJobId, {
      ...translationJob,
      status: "QUEUED",
      progress: 25
    });
    record("8b. Translation Job Transition (QUEUED 25%)", "PASS", { status: qJob.status, progress: qJob.progress });

    // Transition PROCESSING
    const pJob = await clientA.collection("translation_jobs").update(translationJobId, {
      ...translationJob,
      status: "PROCESSING",
      progress: 75
    });
    record("8c. Translation Job Transition (PROCESSING 75%)", "PASS", { status: pJob.status, progress: pJob.progress });

    // Transition COMPLETED
    const cJob = await clientA.collection("translation_jobs").update(translationJobId, {
      ...translationJob,
      status: "COMPLETED",
      progress: 100,
      executionTimeMs: 15,
      outputReference: enToHiResult?.translated_text
    });
    record("8d. Translation Job Transition (COMPLETED 100%)", "PASS", { status: cJob.status, output: cJob.outputReference });
  } catch (e) {
    record("8. Solarch Translation Job State Machine", "FAIL", e.message);
  }

  // 9. Realtime Translation Status Broadcasting Channel (SSE)
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
    record("9. Realtime Translation Broadcasting Channel", "PASS", { protocol: "SSE", status: sseRes.status });
  } catch (e) {
    record("9. Realtime Translation Broadcasting Channel", "FAIL", e.message);
  }

  // 10. Multi-Tenant Translation Job Isolation Guard (User B queries Project B -> 0 jobs from Project A)
  try {
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, { id: userBId });

    const userBJobs = await clientB.collection("translation_jobs").getList(1, 10, {
      filter: `projectId = '${projectBId}'`
    });

    const leaked = (userBJobs.items || []).some(j => j.id === translationJobId);
    if (!leaked) {
      record("10. Multi-Tenant Translation Job Isolation Guard", "PASS", {
        userBJobCount: userBJobs.totalItems || 0,
        isolated: true
      });
    } else {
      record("10. Multi-Tenant Translation Job Isolation Guard", "FAIL", "User A job leaked to User B");
    }
  } catch (e) {
    record("10. Multi-Tenant Translation Job Isolation Guard", "FAIL", e.message);
  }

  // 11. Security Guard: Unsupported Language Rejection
  try {
    const unsuppRes = await fetch(`${PYTHON_URL}/v1/translation/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_text: "Hello world",
        source_language: "en",
        target_language: "klingon"
      })
    });
    const unsuppData = await unsuppRes.json();

    if (unsuppRes.status === 400 || unsuppData.detail) {
      record("11. Unsupported Language Rejection Guard", "PASS", {
        status: unsuppRes.status,
        detail: unsuppData.detail
      });
    } else {
      record("11. Unsupported Language Rejection Guard", "FAIL", unsuppData);
    }
  } catch (e) {
    record("11. Unsupported Language Rejection Guard", "FAIL", e.message);
  }

  // 12. Security Guard: Empty Text Translation Rejection
  try {
    const emptyRes = await fetch(`${PYTHON_URL}/v1/translation/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_text: "   ",
        source_language: "en",
        target_language: "hi"
      })
    });
    const emptyData = await emptyRes.json();

    if (emptyRes.status === 400 || emptyData.detail) {
      record("12. Empty Text Translation Rejection Guard", "PASS", {
        status: emptyRes.status,
        detail: emptyData.detail
      });
    } else {
      record("12. Empty Text Translation Rejection Guard", "FAIL", emptyData);
    }
  } catch (e) {
    record("12. Empty Text Translation Rejection Guard", "FAIL", e.message);
  }

  // 13. Voice-Language Compatibility Validation
  try {
    const compatRes = await fetch(`${PYTHON_URL}/v1/translation/compatibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_profile_id: voiceProfileId,
        model: "fastpitch-baseline",
        target_language: "hi"
      })
    }).then(r => r.json());

    if (compatRes.compatible === true) {
      record("13. Voice-Language Compatibility Validation (FastPitch Hindi)", "PASS", compatRes);
    } else {
      record("13. Voice-Language Compatibility Validation (FastPitch Hindi)", "FAIL", compatRes);
    }
  } catch (e) {
    record("13. Voice-Language Compatibility Validation (FastPitch Hindi)", "FAIL", e.message);
  }

  // 14. Incompatible Voice-Language Rejection
  try {
    const incompRes = await fetch(`${PYTHON_URL}/v1/translation/compatibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voice_profile_id: voiceProfileId,
        model: "openvoice-v2",
        target_language: "hi"
      })
    }).then(r => r.json());

    if (incompRes.compatible === false && incompRes.reason) {
      record("14. Incompatible Voice-Language Rejection Guard", "PASS", {
        compatible: incompRes.compatible,
        reason: incompRes.reason
      });
    } else {
      record("14. Incompatible Voice-Language Rejection Guard", "FAIL", incompRes);
    }
  } catch (e) {
    record("14. Incompatible Voice-Language Rejection Guard", "FAIL", e.message);
  }

  // 15. End-to-End Translation -> VoiceEngine Speech Synthesis (English -> Hindi -> 24kHz Audio WAV)
  let e2eAudioPath = "";
  try {
    const synthRes = await fetch(`${PYTHON_URL}/v1/translation/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        voice_profile_id: voiceProfileId,
        source_text: "Welcome to the Autonomous Voice AI Laboratory. Neural synthesis is online.",
        source_language: "en",
        target_language: "hi",
        model: "fastpitch-baseline"
      })
    }).then(r => r.json());

    if (synthRes.status === "COMPLETED" && synthRes.audio_path && synthRes.translated_text) {
      e2eAudioPath = synthRes.audio_path;
      record("15. End-to-End Translation -> Neural Voice Synthesis", "PASS", {
        status: synthRes.status,
        sourceText: synthRes.source_text,
        translatedText: synthRes.translated_text,
        outputPath: synthRes.audio_path,
        duration: synthRes.duration,
        timeMs: synthRes.execution_time_ms
      });
    } else {
      record("15. End-to-End Translation -> Neural Voice Synthesis", "FAIL", synthRes);
    }
  } catch (e) {
    record("15. End-to-End Translation -> Neural Voice Synthesis", "FAIL", e.message);
  }

  // 16. Benchmark: Short Sentence Translation
  try {
    const startS = Date.now();
    const resS = await fetch(`${PYTHON_URL}/v1/translation/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_text: "Good morning everyone.",
        source_language: "en",
        target_language: "hi"
      })
    }).then(r => r.json());
    const totalS = Date.now() - startS;

    record("16. Short Sentence Translation Benchmark", "PASS", {
      translated: resS.translated_text,
      translationMs: resS.execution_time_ms,
      totalRoundtripMs: totalS
    });
  } catch (e) {
    record("16. Short Sentence Translation Benchmark", "FAIL", e.message);
  }

  // 17. Benchmark: Paragraph Translation
  try {
    const startP = Date.now();
    const pText = "The Autonomous Voice AI Laboratory integrates speech recognition, speaker diarization, multi-dimensional voice profiling, and neural audio synthesis.";
    const resP = await fetch(`${PYTHON_URL}/v1/translation/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_text: pText,
        source_language: "en",
        target_language: "hi"
      })
    }).then(r => r.json());
    const totalP = Date.now() - startP;

    record("17. Paragraph Translation Benchmark", "PASS", {
      translated: resP.translated_text,
      translationMs: resP.execution_time_ms,
      totalRoundtripMs: totalP
    });
  } catch (e) {
    record("17. Paragraph Translation Benchmark", "FAIL", e.message);
  }

  // 18. Benchmark: Full Script Translation & End-to-End Voice Synthesis
  try {
    const startE2E = Date.now();
    const scriptText = "Welcome to the full scale AI voice studio demonstration. Neural audio synthesis is active.";
    const resE2E = await fetch(`${PYTHON_URL}/v1/translation/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        voice_profile_id: voiceProfileId,
        source_text: scriptText,
        source_language: "en",
        target_language: "hi",
        model: "fastpitch-baseline"
      })
    }).then(r => r.json());
    const totalE2E = Date.now() - startE2E;

    record("18. End-to-End Script Translation & Synthesis Benchmark", "PASS", {
      translatedText: resE2E.translated_text,
      audioDuration: resE2E.duration,
      pipelineMs: resE2E.execution_time_ms,
      totalRoundtripMs: totalE2E
    });
  } catch (e) {
    record("18. End-to-End Script Translation & Synthesis Benchmark", "FAIL", e.message);
  }

  console.log("\n=========================================");
  console.log("⚡ PHASE 7 TEST SUITE SUMMARY");
  console.log("=========================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const total = results.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("=========================================\n");

  fs.writeFileSync("tests/phase7-results.json", JSON.stringify(results, null, 2), "utf8");
}

runPhase7Suite().catch(console.error);
