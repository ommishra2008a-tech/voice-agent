/**
 * Phase 12C: Targeted Canonical Saved Voice Reuse & Process Audio Separation Test
 */

const fs = require('fs');
const path = require('path');

const AI_BASE = 'http://localhost:8000';
const SOLARCH_BASE = 'http://localhost:8090';

async function runTest() {
  console.log('================================================================');
  console.log('PHASE 12C: SAVED VOICE CANONICAL REUSE & MEDIA SEPARATION TEST');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  // 1. STEP 1: Verify Audio Upload & Analysis returns clean analysis result
  let serverAudioPath = '';
  try {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'sample_speech.wav');
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${fixturePath}`);
    }

    const fileBuffer = fs.readFileSync(fixturePath);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const postData = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="aadi.wav"\r\nContent-Type: audio/wav\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await fetch(`${AI_BASE}/v1/voice/upload`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: postData
    });
    const uploadData = await uploadRes.json();
    serverAudioPath = uploadData.audio_path;

    const analyzeRes = await fetch(`${AI_BASE}/v1/voice/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_path: serverAudioPath, speaker_id: 'speaker_1' })
    });
    const analysisData = await analyzeRes.json();

    if (analyzeRes.ok && (analysisData.status === 'COMPLETED' || analysisData.status === 'READY') && analysisData.quality?.quality_gate_passed) {
      console.log(`[PASS] TEST-12C-01: Voice Reference Upload & Analysis Complete — Reference Quality: ${analysisData.quality.quality_score}/100`);
      passed++;
    } else {
      throw new Error(`Analysis failed: ${JSON.stringify(analysisData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-12C-01: Upload & Analysis Failed —`, err.message);
    failed++;
  }

  // 2. STEP 2: Create Voice Profile "aadi" via AI Backend and Persist to Solarch BaaS PocketBase
  let backendProfileId = '';
  let solarchRecordId = '';
  let durableRefPath = '';

  try {
    const createRes = await fetch(`${AI_BASE}/v1/voice/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'test_project_12c',
        user_id: 'test_user_12c',
        name: 'aadi',
        source_asset_ids: [],
        audio_paths: [serverAudioPath],
        target_speaker_id: 'speaker_1',
        language: 'en'
      })
    });
    const profileData = await createRes.json();
    backendProfileId = profileData.voice_profile_id;
    durableRefPath = profileData.primary_reference_path;

    // Persist to Solarch BaaS PocketBase with canonical mappings
    const solarchPayload = {
      projectId: 'test_project_12c',
      userId: 'test_user_12c',
      name: 'aadi',
      speakerId: 'speaker_1',
      sourceAssetId: backendProfileId,
      referenceAudio: durableRefPath,
      speakerEmbedding: JSON.stringify(profileData.embedding?.embedding || [0.1, 0.2]),
      pitchStats: JSON.stringify(profileData.pitch || {}),
      timbreCharacteristics: JSON.stringify(profileData.timbre || {}),
      prosodyProfile: JSON.stringify(profileData.prosody || {}),
      styleProfile: JSON.stringify(profileData.style || {}),
      emotionProfile: JSON.stringify(profileData.emotion || {})
    };

    const pbRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(solarchPayload)
    });
    const pbData = await pbRes.json();
    solarchRecordId = pbData.id;

    if (pbRes.ok && solarchRecordId && durableRefPath && fs.existsSync(durableRefPath)) {
      console.log(`[PASS] TEST-12C-02: Solarch BaaS Record Created — PB Record ID: ${solarchRecordId}, Backend ID: ${backendProfileId}, Ref: ${durableRefPath}`);
      passed++;
    } else {
      throw new Error(`Solarch creation failed: ${JSON.stringify(pbData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-12C-02: Profile Creation Failed —`, err.message);
    failed++;
  }

  // 3. STEP 3: Synthesize Speech Using ONLY the Solarch Record ID (Simulating Reload / Live UI request)
  try {
    const synthRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'test_project_12c',
        user_id: 'test_user_12c',
        voice_profile_id: solarchRecordId, // The exact ID from Solarch that previously caused VOICE_REFERENCE_UNAVAILABLE
        text: 'Hello, this is my saved voice test with canonical resolution.',
        model: 'xtts-v2',
        language: 'en'
      })
    });
    const synthData = await synthRes.json();

    if (synthRes.ok && synthData.status === 'COMPLETED' && fs.existsSync(synthData.audio_path)) {
      console.log(`[PASS] TEST-12C-03: Speech Generated via Solarch Record ID '${solarchRecordId}' without Re-upload — Audio: ${synthData.audio_path}, Duration: ${synthData.duration}s`);
      passed++;
    } else {
      throw new Error(`Synthesis failed: ${JSON.stringify(synthData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-12C-03: Synthesis with Solarch ID Failed —`, err.message);
    failed++;
  }

  // 4. STEP 4: Synthesize Speech using profile name 'aadi'
  try {
    const synthRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'test_project_12c',
        user_id: 'test_user_12c',
        voice_profile_id: 'aadi',
        text: 'This is a secondary sentence verifying name-based canonical resolution.',
        model: 'xtts-v2',
        language: 'en'
      })
    });
    const synthData = await synthRes.json();

    if (synthRes.ok && synthData.status === 'COMPLETED' && fs.existsSync(synthData.audio_path)) {
      console.log(`[PASS] TEST-12C-04: Speech Generated via Profile Name 'aadi' — Audio: ${synthData.audio_path}`);
      passed++;
    } else {
      throw new Error(`Synthesis via name failed: ${JSON.stringify(synthData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-12C-04: Name Synthesis Failed —`, err.message);
    failed++;
  }

  // 5. STEP 5: Strict Non-Fallback Verification (Non-existent profile ID must reject with 400)
  try {
    const fakeRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'test_project_12c',
        user_id: 'test_user_12c',
        voice_profile_id: 'completely_unknown_profile_id_xyz',
        text: 'Should strictly fail.',
        model: 'xtts-v2',
        language: 'en'
      })
    });
    const fakeData = await fakeRes.json();
    if (fakeRes.status === 400 && fakeData.detail && fakeData.detail.includes('VOICE_REFERENCE_UNAVAILABLE')) {
      console.log(`[PASS] TEST-12C-05: Strict Policy Enforced: Unknown profile rejected with 400 + VOICE_REFERENCE_UNAVAILABLE`);
      passed++;
    } else {
      throw new Error(`Expected 400 VOICE_REFERENCE_UNAVAILABLE, got ${fakeRes.status}: ${JSON.stringify(fakeData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-12C-05: Non-fallback check failed —`, err.message);
    failed++;
  }

  console.log('================================================================');
  console.log(`PHASE 12C TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTest();
