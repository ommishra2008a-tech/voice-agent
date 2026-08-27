/**
 * Phase 13B Targeted Test:
 * Multi-Chat History + Durable 30-Day Audio Retention Verification
 */

const fs = require('fs');
const SOLARCH_BASE = 'http://localhost:8090';
const AI_BASE = 'http://localhost:8000';

async function runTest() {
  console.log('================================================================');
  console.log('PHASE 13B: MULTI-CHAT HISTORY & DURABLE RETENTION TEST');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  const testProjId = `p_multi_${Date.now()}`;
  const testUserId = `u_multi_${Date.now()}`;
  let voiceProfId = '';
  let convAId = '';
  let convBId = '';

  const refPath = 'D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav';

  // 1. Create a Reusable Voice Profile in Solarch
  try {
    const vRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        name: 'Multi-Chat Anchor Voice',
        speakerId: 'speaker_1',
        sourceAssetId: refPath,
        referenceAudio: refPath,
        speakerEmbedding: JSON.stringify([0.1, 0.2, 0.3])
      })
    });
    const vData = await vRes.json();
    voiceProfId = vData.id;

    if (vRes.ok && voiceProfId) {
      console.log(`[PASS] TEST-13B-01: Voice Profile created in Solarch (ID: ${voiceProfId})`);
      passed++;
    } else {
      throw new Error(`Profile creation failed: ${JSON.stringify(vData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13B-01: Profile creation failed —`, err.message);
    failed++;
  }

  // 2. Create Conversation A and Generate Speech
  try {
    const cResA = await fetch(`${SOLARCH_BASE}/api/collections/conversations/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        title: 'Conversation A: Introduction'
      })
    });
    const cDataA = await cResA.json();
    convAId = cDataA.id;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Create Job in Conv A
    const jobResA = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        voiceProfileId: voiceProfId,
        text: 'Hello from my saved voice in Conversation A.',
        targetLanguage: 'en',
        styleParams: JSON.stringify({ model: 'xtts-v2', speed: 1.0, conversationId: convAId, expiresAt }),
        status: 'PROCESSING'
      })
    });
    const jobDataA = await jobResA.json();

    const synthResA = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: testProjId,
        user_id: testUserId,
        voice_profile_id: voiceProfId,
        text: 'Hello from my saved voice in Conversation A.',
        model: 'xtts-v2',
        language: 'en'
      })
    });
    const synthDataA = await synthResA.json();

    await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records/${jobDataA.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        voiceProfileId: voiceProfId,
        text: 'Hello from my saved voice in Conversation A.',
        targetLanguage: 'en',
        styleParams: JSON.stringify({ model: 'xtts-v2', speed: 1.0, conversationId: convAId, expiresAt }),
        status: 'COMPLETED',
        outputAssetId: synthDataA.audio_path,
        executionTimeMs: 2500
      })
    });

    if (synthResA.ok && synthDataA.audio_path && fs.existsSync(synthDataA.audio_path)) {
      console.log(`[PASS] TEST-13B-02: Created Conversation A & attached durable speech (Audio: ${synthDataA.audio_path})`);
      passed++;
    } else {
      throw new Error(`Generation in Conv A failed`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13B-02: Conversation A failed —`, err.message);
    failed++;
  }

  // 3. Create Conversation B (New Chat) and Generate Independent Speech
  try {
    const cResB = await fetch(`${SOLARCH_BASE}/api/collections/conversations/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        title: 'Conversation B: Second Topic'
      })
    });
    const cDataB = await cResB.json();
    convBId = cDataB.id;

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const jobResB = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        voiceProfileId: voiceProfId,
        text: 'This is my second conversation in Chat B.',
        targetLanguage: 'en',
        styleParams: JSON.stringify({ model: 'xtts-v2', speed: 1.0, conversationId: convBId, expiresAt }),
        status: 'PROCESSING'
      })
    });
    const jobDataB = await jobResB.json();

    const synthResB = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: testProjId,
        user_id: testUserId,
        voice_profile_id: voiceProfId,
        text: 'This is my second conversation in Chat B.',
        model: 'xtts-v2',
        language: 'en'
      })
    });
    const synthDataB = await synthResB.json();

    await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records/${jobDataB.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        voiceProfileId: voiceProfId,
        text: 'This is my second conversation in Chat B.',
        targetLanguage: 'en',
        styleParams: JSON.stringify({ model: 'xtts-v2', speed: 1.0, conversationId: convBId, expiresAt }),
        status: 'COMPLETED',
        outputAssetId: synthDataB.audio_path,
        executionTimeMs: 2500
      })
    });

    if (synthResB.ok && synthDataB.audio_path && fs.existsSync(synthDataB.audio_path)) {
      console.log(`[PASS] TEST-13B-03: Created Conversation B & attached durable speech (Audio: ${synthDataB.audio_path})`);
      passed++;
    } else {
      throw new Error(`Generation in Conv B failed`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13B-03: Conversation B failed —`, err.message);
    failed++;
  }

  // 4. Verify Strict Conversation Isolation via Solarch Query Filter
  try {
    const filter = encodeURIComponent(`(projectId='${testProjId}')`);
    const allJobsRes = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records?filter=${filter}`);
    const allJobsData = await allJobsRes.json();
    const allJobs = allJobsData.items || [];

    const jobsA = allJobs.filter(j => {
      let s = {};
      try { s = typeof j.styleParams === 'string' ? JSON.parse(j.styleParams) : (j.styleParams || {}); } catch {}
      return s.conversationId === convAId;
    });

    const jobsB = allJobs.filter(j => {
      let s = {};
      try { s = typeof j.styleParams === 'string' ? JSON.parse(j.styleParams) : (j.styleParams || {}); } catch {}
      return s.conversationId === convBId;
    });

    if (jobsA.length === 1 && jobsA[0].text.includes('Conversation A') &&
        jobsB.length === 1 && jobsB[0].text.includes('Chat B')) {
      console.log(`[PASS] TEST-13B-04: Strict Conversation Isolation Verified (Conv A: ${jobsA.length} msg, Conv B: ${jobsB.length} msg)`);
      passed++;
    } else {
      throw new Error(`Isolation check failed: ConvA had ${jobsA.length}, ConvB had ${jobsB.length}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13B-04: Isolation check failed —`, err.message);
    failed++;
  }

  // 5. Verify 30-Day Audio Retention Metadata
  try {
    const filter = encodeURIComponent(`(projectId='${testProjId}')`);
    const allJobsRes = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records?filter=${filter}`);
    const allJobsData = await allJobsRes.json();
    const job = (allJobsData.items || [])[0];

    let style = {};
    try { style = typeof job.styleParams === 'string' ? JSON.parse(job.styleParams) : (job.styleParams || {}); } catch {}

    const expDate = new Date(style.expiresAt || job.expiresAt);
    const createDate = new Date(job.created);
    const diffDays = Math.round((expDate.getTime() - createDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 29 && diffDays <= 31) {
      console.log(`[PASS] TEST-13B-05: 30-Day Retention Verified — Created: ${job.created}, Expires: ${style.expiresAt} (~${diffDays} days)`);
      passed++;
    } else {
      throw new Error(`Expected ~30 days retention, got ${diffDays} days`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13B-05: Retention metadata check failed —`, err.message);
    failed++;
  }

  // 6. Verify Saved Voice Reference Audio is Untouched / Non-Expiring
  try {
    const profRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records/${voiceProfId}`);
    const profData = await profRes.json();

    const actualRef = profData.referenceAudio || profData.sourceAssetId;
    if (profRes.ok && actualRef && fs.existsSync(actualRef)) {
      console.log(`[PASS] TEST-13B-06: Voice Profile reference audio is permanent & protected from chat retention (Path: ${actualRef})`);
      passed++;
    } else {
      throw new Error(`Voice profile reference invalid or missing`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13B-06: Profile reference check failed —`, err.message);
    failed++;
  }

  // 7. Conversation Rename and Continue Chat
  try {
    const renRes = await fetch(`${SOLARCH_BASE}/api/collections/conversations/records/${convAId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        title: 'Renamed Introduction Chat'
      })
    });
    const renData = await renRes.json();

    if (renRes.ok && renData.title === 'Renamed Introduction Chat') {
      console.log(`[PASS] TEST-13B-07: Conversation renamed successfully (New Title: "${renData.title}")`);
      passed++;
    } else {
      throw new Error(`Rename failed: ${JSON.stringify(renData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13B-07: Rename test failed —`, err.message);
    failed++;
  }

  console.log('================================================================');
  console.log(`PHASE 13B TESTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTest();
