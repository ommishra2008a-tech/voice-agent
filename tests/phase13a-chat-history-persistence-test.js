/**
 * Phase 13A Targeted Verification:
 * Persistent Voice History & Audio Recovery Verification
 */

const fs = require('fs');
const SOLARCH_BASE = 'http://localhost:8090';
const AI_BASE = 'http://localhost:8000';

async function runTest() {
  console.log('================================================================');
  console.log('PHASE 13A: PERSISTENT VOICE HISTORY & ASSET RECOVERY TEST');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  const testProjId = `p_persist_${Date.now()}`;
  const testUserId = `u_persist_${Date.now()}`;
  let createdProfileId = '';
  let createdJobId = '';
  let generatedAudioPath = '';

  // 1. Create a Voice Profile in Solarch
  try {
    const pRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        name: 'Persistence Anchor Voice',
        speakerId: 'speaker_1',
        sourceAssetId: 'vp_asset_persist_1',
        referenceAudio: 'D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav',
        primaryReferencePath: 'D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav',
        speakerEmbedding: JSON.stringify([0.1, 0.2, 0.3]),
        qualityScore: 89.0,
        qualityGatePassed: true,
        readinessState: 'READY'
      })
    });
    const pData = await pRes.json();
    createdProfileId = pData.id;

    if (pRes.ok && createdProfileId) {
      console.log(`[PASS] TEST-13A-01: Voice Profile created in Solarch (ID: ${createdProfileId})`);
      passed++;
    } else {
      throw new Error(`Profile creation failed: ${JSON.stringify(pData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13A-01: Profile creation failed —`, err.message);
    failed++;
  }

  // 2. Synthesize Speech & Create Generation Job in Solarch
  try {
    // A: Create job record in PENDING / PROCESSING state
    const jobRes = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        voiceProfileId: createdProfileId,
        text: 'This is a durable speech synthesis test verifying browser refresh persistence.',
        targetLanguage: 'en',
        styleParams: JSON.stringify({ model: 'xtts-v2', speed: 1.0, pitch: 0, emotion: 'natural', voiceName: 'Persistence Anchor Voice' }),
        status: 'PROCESSING'
      })
    });
    const jobData = await jobRes.json();
    createdJobId = jobData.id;

    // B: Execute speech generation
    const synthRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: testProjId,
        user_id: testUserId,
        voice_profile_id: createdProfileId,
        text: 'This is a durable speech synthesis test verifying browser refresh persistence.',
        model: 'xtts-v2',
        language: 'en',
        speed: 1.0
      })
    });
    const synthData = await synthRes.json();
    generatedAudioPath = synthData.audio_path;

    // C: Update job record to COMPLETED with durable outputAssetId
    const updateRes = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records/${createdJobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: testProjId,
        userId: testUserId,
        voiceProfileId: createdProfileId,
        text: 'This is a durable speech synthesis test verifying browser refresh persistence.',
        targetLanguage: 'en',
        styleParams: JSON.stringify({ model: 'xtts-v2', speed: 1.0, pitch: 0, emotion: 'natural', voiceName: 'Persistence Anchor Voice' }),
        status: 'COMPLETED',
        outputAssetId: generatedAudioPath,
        executionTimeMs: Math.round((synthData.duration || 3.0) * 1000)
      })
    });

    if (synthRes.ok && updateRes.ok && generatedAudioPath && fs.existsSync(generatedAudioPath)) {
      console.log(`[PASS] TEST-13A-02: Speech generated and job saved with outputAssetId (Path: ${generatedAudioPath})`);
      passed++;
    } else {
      throw new Error(`Generation or job update failed: ${JSON.stringify(synthData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13A-02: Speech generation failed —`, err.message);
    failed++;
  }

  // 3. Simulate Browser Refresh: Fetch Generation Jobs from Solarch
  try {
    const listRes = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records?filter=(projectId='${testProjId}')&sort=-created`);
    const listData = await listRes.json();
    const items = listData.items || [];

    const matchedJob = items.find(j => j.id === createdJobId);
    if (matchedJob && matchedJob.outputAssetId === generatedAudioPath && matchedJob.status === 'COMPLETED') {
      console.log(`[PASS] TEST-13A-03: Refresh simulation: Retrieved persistent chat job from Solarch (Job ID: ${matchedJob.id})`);
      passed++;
    } else {
      throw new Error(`Job not restored properly: ${JSON.stringify(listData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13A-03: Refresh recovery failed —`, err.message);
    failed++;
  }

  // 4. Test Durable Audio Streaming Endpoint for Reconstructed Chat Card
  try {
    const streamUrl = `${AI_BASE}/v1/media/audio/raw?path=${encodeURIComponent(generatedAudioPath)}`;
    const streamRes = await fetch(streamUrl);

    if (streamRes.ok && streamRes.headers.get('content-type')?.includes('audio')) {
      console.log(`[PASS] TEST-13A-04: Reconstructed audio playable via streaming endpoint (HTTP ${streamRes.status})`);
      passed++;
    } else {
      throw new Error(`Audio streaming failed with status ${streamRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13A-04: Audio streaming failed —`, err.message);
    failed++;
  }

  // 5. Test Historical Asset Recovery: gen_1787833546649.wav
  try {
    const targetFile = 'D:\\testing\\projects\\AGENT\\voice-agent\\services\\ai-service\\storage\\generated_audio\\gen_1787833546649.wav';
    if (fs.existsSync(targetFile)) {
      const stats = fs.statSync(targetFile);
      console.log(`[PASS] TEST-13A-05: Target gen_1787833546649 recovered on disk (${stats.size} bytes)`);
      passed++;
    } else {
      throw new Error(`Target file gen_1787833546649.wav not found on disk`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-13A-05: Historical asset recovery check failed —`, err.message);
    failed++;
  }

  console.log('================================================================');
  console.log(`PHASE 13A TESTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTest();
