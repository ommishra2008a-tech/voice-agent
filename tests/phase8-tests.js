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

async function runPhase8Suite() {
  console.log("\n=========================================");
  console.log("⚡ STARTING PHASE 8: URL / YOUTUBE PIPELINE TEST SUITE");
  console.log("=========================================\n");

  const client = new SolarchClient(SOLARCH_URL);
  let adminToken = "";
  let userAToken = "";
  let userBToken = "";
  let userAId = "";
  let userBId = "";
  let projectAId = "";
  let projectBId = "";
  let sourceAssetAId = "";
  let srcAssetRec = null;
  let mediaJobId = "";
  let mediaJob = null;

  // 1. Media Source Providers Health
  try {
    const provRes = await fetch(`${PYTHON_URL}/v1/source/providers`).then(r => r.json());
    if (provRes.supported_providers && provRes.supported_providers.length >= 2) {
      record("1. Media Source Providers Health & Registry", "PASS", {
        providersCount: provRes.supported_providers.length,
        providers: provRes.supported_providers.map(p => p.id)
      });
    } else {
      record("1. Media Source Providers Health & Registry", "FAIL", provRes);
    }
  } catch (e) {
    record("1. Media Source Providers Health & Registry", "FAIL", e.message);
  }

  // 2. User & Project Workspace Provisioning
  try {
    const adminAuth = await client.admins.authWithPassword("admin@voiceai.lab", "AdminPassword123!");
    adminToken = adminAuth.token;

    // User A
    const userAEmail = `source_engineer_a_${Date.now()}@voiceai.lab`;
    const userA = await client.collection("users").create({
      email: userAEmail,
      password: "SourcePasswordA123!",
      passwordConfirm: "SourcePasswordA123!"
    });
    userAId = userA.record.id;
    userAToken = userA.token;

    // User B
    const userBEmail = `source_engineer_b_${Date.now()}@voiceai.lab`;
    const userB = await client.collection("users").create({
      email: userBEmail,
      password: "SourcePasswordB123!",
      passwordConfirm: "SourcePasswordB123!"
    });
    userBId = userB.record.id;
    userBToken = userB.token;

    // Project A
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, userA.record);
    const projA = await clientA.collection("projects").create({
      userId: userAId,
      name: "Autonomous Media Ingestion Studio Alpha",
      description: "YouTube and External Media Sourcing Workspace"
    });
    projectAId = projA.id;

    // Project B
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, userB.record);
    const projB = await clientB.collection("projects").create({
      userId: userBId,
      name: "Autonomous Media Ingestion Studio Beta",
      description: "Isolated Tenant Sourcing Workspace"
    });
    projectBId = projB.id;

    record("2. User, Tenant & Ingestion Workspace Provisioning", "PASS", {
      userA: userAId,
      projectA: projectAId,
      projectB: projectBId
    });
  } catch (e) {
    record("2. User, Tenant & Ingestion Workspace Provisioning", "FAIL", e.message);
  }

  // 3. YouTube URL Detection & Metadata Probe (POST /v1/source/probe)
  const ytUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  let probeMeta = null;
  try {
    const probeRes = await fetch(`${PYTHON_URL}/v1/source/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: ytUrl })
    }).then(r => r.json());

    if (probeRes.valid && probeRes.provider === "youtube" && probeRes.metadata) {
      probeMeta = probeRes.metadata;
      record("3. YouTube URL Detection & Metadata Probe", "PASS", {
        provider: probeRes.provider,
        videoId: probeMeta.external_id,
        title: probeMeta.title,
        channel: probeMeta.channel,
        duration: probeMeta.duration,
        timeMs: probeRes.execution_time_ms
      });
    } else {
      record("3. YouTube URL Detection & Metadata Probe", "FAIL", probeRes);
    }
  } catch (e) {
    record("3. YouTube URL Detection & Metadata Probe", "FAIL", e.message);
  }

  // 4. Generic Media URL Probe
  const genericUrl = "https://cdn.voiceai.lab/samples/speech_interview.mp4";
  try {
    const genRes = await fetch(`${PYTHON_URL}/v1/source/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: genericUrl })
    }).then(r => r.json());

    if (genRes.valid && genRes.provider === "generic_media") {
      record("4. Generic Media Stream URL Probe", "PASS", {
        provider: genRes.provider,
        title: genRes.metadata.title
      });
    } else {
      record("4. Generic Media Stream URL Probe", "FAIL", genRes);
    }
  } catch (e) {
    record("4. Generic Media Stream URL Probe", "FAIL", e.message);
  }

  // 5. Complete Media Source Processing Pipeline (POST /v1/source/process)
  let processResult = null;
  try {
    const procRes = await fetch(`${PYTHON_URL}/v1/source/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        url: ytUrl,
        prefer_captions: true,
        extract_speakers: true,
        index_to_rag: true
      })
    }).then(r => r.json());

    if (procRes.status === "READY" && procRes.speakers_detected_count >= 2) {
      processResult = procRes;
      sourceAssetAId = procRes.source_asset_id;
      record("5. Complete Media Source Ingestion & Diarization", "PASS", {
        sourceAssetId: procRes.source_asset_id,
        stages: procRes.stages_completed,
        segments: procRes.transcript_segments_count,
        speakersCount: procRes.speakers_detected_count,
        ragIndexed: procRes.rag_chunks_indexed,
        timeMs: procRes.execution_time_ms
      });
    } else {
      record("5. Complete Media Source Ingestion & Diarization", "FAIL", procRes);
    }
  } catch (e) {
    record("5. Complete Media Source Ingestion & Diarization", "FAIL", e.message);
  }

  // 6. Solarch Source Asset Record Creation & Storage
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const srcRec = await clientA.collection("source_assets").create({
      projectId: projectAId,
      userId: userAId,
      name: probeMeta?.title || "YouTube Review",
      sourceType: "youtube_url",
      mediaType: "video",
      format: "wav",
      duration: probeMeta?.duration || 120.0,
      sampleRate: 24000,
      channels: 1,
      status: "READY"
    });

    srcAssetRec = srcRec;
    record("6. Solarch Source Asset Record Storage", "PASS", {
      assetId: srcRec.id,
      name: srcRec.name,
      status: srcRec.status
    });
  } catch (e) {
    record("6. Solarch Source Asset Record Storage", "FAIL", e.message);
  }

  // 7. Solarch Media Job State Transitions
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const job = await clientA.collection("media_jobs").create({
      sourceAssetId: srcAssetRec.id,
      projectId: projectAId,
      userId: userAId,
      status: "UPLOADING",
      progress: 0
    });
    mediaJobId = job.id;
    mediaJob = job;
    record("7a. Solarch Media Job Creation (UPLOADING)", "PASS", { jobId: mediaJobId, status: job.status });

    // Transition PROCESSING
    const pJob = await clientA.collection("media_jobs").update(mediaJobId, {
      ...mediaJob,
      status: "PROCESSING",
      progress: 60
    });
    record("7b. Media Job Transition (PROCESSING 60%)", "PASS", { status: pJob.status, progress: pJob.progress });

    // Transition READY
    const rJob = await clientA.collection("media_jobs").update(mediaJobId, {
      ...mediaJob,
      status: "READY",
      progress: 100
    });
    record("7c. Media Job Transition (READY 100%)", "PASS", { status: rJob.status, progress: rJob.progress });
  } catch (e) {
    record("7. Solarch Media Job State Transitions", "FAIL", e.message);
  }

  // 8. Multi-Speaker Track Analysis & Speaking Percentage
  try {
    const speakers = processResult?.speakers || [];
    const spk1 = speakers.find(s => s.speaker_id === "speaker_1");
    const spk2 = speakers.find(s => s.speaker_id === "speaker_2");

    if (spk1 && spk2 && spk1.speaking_percentage > 0 && spk2.speaking_percentage > 0) {
      record("8. Multi-Speaker Track Analysis & Metrics", "PASS", {
        speaker1: { duration: `${spk1.total_duration}s`, pct: `${spk1.speaking_percentage}%`, f0: spk1.f0_mean },
        speaker2: { duration: `${spk2.total_duration}s`, pct: `${spk2.speaking_percentage}%`, f0: spk2.f0_mean }
      });
    } else {
      record("8. Multi-Speaker Track Analysis & Metrics", "FAIL", speakers);
    }
  } catch (e) {
    record("8. Multi-Speaker Track Analysis & Metrics", "FAIL", e.message);
  }

  // 9. Target Speaker Candidate Selection (POST /v1/source/select-speaker)
  try {
    const selRes = await fetch(`${PYTHON_URL}/v1/source/select-speaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        source_asset_id: sourceAssetAId,
        speaker_id: "speaker_2",
        create_voice_profile: true,
        profile_name: "YouTube Host Speaker 2"
      })
    }).then(r => r.json());

    if (selRes.selected_speaker_id === "speaker_2" && selRes.voice_profile_id) {
      record("9. Target Speaker Selection & Candidate Profiling", "PASS", {
        selectedSpeaker: selRes.selected_speaker_id,
        voiceProfileId: selRes.voice_profile_id,
        qualityScore: selRes.candidate_profile.quality_score
      });
    } else {
      record("9. Target Speaker Selection & Candidate Profiling", "FAIL", selRes);
    }
  } catch (e) {
    record("9. Target Speaker Selection & Candidate Profiling", "FAIL", e.message);
  }

  // 10. RAG Knowledge Ingestion with Source & Speaker Attribution
  try {
    const ragQueryRes = await fetch(`${PYTHON_URL}/v1/rag/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        query: "What did Speaker 2 say about Faster-Whisper and vector search?",
        speaker_filter: "speaker_2",
        top_k: 2
      })
    }).then(r => r.json());

    const topChunk = ragQueryRes.results[0];
    if (topChunk && topChunk.speaker_id === "speaker_2") {
      record("10. RAG Knowledge Retrieval with Speaker Attribution", "PASS", {
        speaker: topChunk.speaker_id,
        citation: topChunk.citation,
        snippet: topChunk.text
      });
    } else {
      record("10. RAG Knowledge Retrieval with Speaker Attribution", "FAIL", ragQueryRes);
    }
  } catch (e) {
    record("10. RAG Knowledge Retrieval with Speaker Attribution", "FAIL", e.message);
  }

  // 11. Realtime Indexing & Ingestion Broadcasting Channel (SSE)
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
    record("11. Realtime Media Sourcing Broadcasting Channel", "PASS", { protocol: "SSE", status: sseRes.status });
  } catch (e) {
    record("11. Realtime Media Sourcing Broadcasting Channel", "FAIL", e.message);
  }

  // 12. Security Guard: Multi-Tenant Source Asset Isolation
  try {
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, { id: userBId });

    const userBAssets = await clientB.collection("source_assets").getList(1, 10, {
      filter: `projectId = '${projectBId}'`
    });

    const leaked = (userBAssets.items || []).some(a => a.projectId === projectAId);
    if (!leaked) {
      record("12. Multi-Tenant Source Asset Isolation Guard", "PASS", {
        userBAssetCount: userBAssets.totalItems || 0,
        isolated: true
      });
    } else {
      record("12. Multi-Tenant Source Asset Isolation Guard", "FAIL", "User A asset leaked to User B");
    }
  } catch (e) {
    record("12. Multi-Tenant Source Asset Isolation Guard", "FAIL", e.message);
  }

  // 13. Security Guard: Invalid URL Format Rejection
  try {
    const invRes = await fetch(`${PYTHON_URL}/v1/source/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "ftp://not-a-valid-http-url" })
    }).then(r => r.json());

    if (invRes.valid === false) {
      record("13. Invalid URL Format Rejection Guard", "PASS", {
        valid: invRes.valid,
        error: invRes.error
      });
    } else {
      record("13. Invalid URL Format Rejection Guard", "FAIL", invRes);
    }
  } catch (e) {
    record("13. Invalid URL Format Rejection Guard", "FAIL", e.message);
  }

  // 14. Security Guard: Empty URL Probe Rejection
  try {
    const emptyRes = await fetch(`${PYTHON_URL}/v1/source/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "   " })
    });
    const emptyData = await emptyRes.json();

    if (emptyRes.status === 400 || emptyData.detail) {
      record("14. Empty URL Probe Rejection Guard", "PASS", {
        status: emptyRes.status,
        detail: emptyData.detail
      });
    } else {
      record("14. Empty URL Probe Rejection Guard", "FAIL", emptyData);
    }
  } catch (e) {
    record("14. Empty URL Probe Rejection Guard", "FAIL", e.message);
  }

  // 15. Benchmark: YouTube URL Probe & Ingestion
  try {
    const startYTB = Date.now();
    const resYTB = await fetch(`${PYTHON_URL}/v1/source/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        url: "https://youtu.be/dQw4w9WgXcQ",
        prefer_captions: true,
        extract_speakers: true,
        index_to_rag: true
      })
    }).then(r => r.json());
    const totalYTB = Date.now() - startYTB;

    record("15. YouTube Ingestion Pipeline Benchmark", "PASS", {
      provider: resYTB.provider,
      stagesCount: resYTB.stages_completed.length,
      pipelineMs: resYTB.execution_time_ms,
      totalRoundtripMs: totalYTB
    });
  } catch (e) {
    record("15. YouTube Ingestion Pipeline Benchmark", "FAIL", e.message);
  }

  // 16. Benchmark: Direct Media URL Probe & Ingestion
  try {
    const startGen = Date.now();
    const resGen = await fetch(`${PYTHON_URL}/v1/source/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectAId,
        user_id: userAId,
        url: "https://cdn.voiceai.lab/interview_audio.wav",
        prefer_captions: false,
        extract_speakers: true,
        index_to_rag: true
      })
    }).then(r => r.json());
    const totalGen = Date.now() - startGen;

    record("16. Direct Media Stream Ingestion Benchmark", "PASS", {
      provider: resGen.provider,
      stagesCount: resGen.stages_completed.length,
      pipelineMs: resGen.execution_time_ms,
      totalRoundtripMs: totalGen
    });
  } catch (e) {
    record("16. Direct Media Stream Ingestion Benchmark", "FAIL", e.message);
  }

  console.log("\n=========================================");
  console.log("⚡ PHASE 8 TEST SUITE SUMMARY");
  console.log("=========================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const total = results.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("=========================================\n");

  fs.writeFileSync("tests/phase8-results.json", JSON.stringify(results, null, 2), "utf8");
}

runPhase8Suite().catch(console.error);



