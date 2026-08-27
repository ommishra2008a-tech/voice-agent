/**
 * Targeted Test: Voice Library Management (Select / Preview / Rename / Delete)
 */

const SOLARCH_BASE = 'http://localhost:8090';
const AI_BASE = 'http://localhost:8000';

async function runTest() {
  console.log('================================================================');
  console.log('TARGETED TEST: VOICE LIBRARY (SELECT / RENAME / DELETE / PREVIEW)');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  let createdProfileId = '';

  // 1. Create a test profile in Solarch BaaS PocketBase
  try {
    const payload = {
      projectId: 'test_proj_lib',
      userId: 'test_user_lib',
      name: 'Temporary Test Voice',
      speakerId: 'speaker_1',
      sourceAssetId: 'vp_test_asset_123',
      referenceAudio: 'D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav',
      primaryReferencePath: 'D:\\testing\\projects\\AGENT\\voice-agent\\tests\\fixtures\\sample_speech.wav',
      speakerEmbedding: JSON.stringify([0.1, 0.2, 0.3]),
      qualityScore: 88.5,
      qualityGatePassed: true,
      readinessState: 'READY'
    };

    const res = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    createdProfileId = data.id;

    if (res.ok && createdProfileId) {
      console.log(`[PASS] TEST-LIB-01: Voice Profile Created in Solarch — ID: ${createdProfileId}, Name: ${data.name}`);
      passed++;
    } else {
      throw new Error(`Profile creation failed: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-LIB-01: Profile creation failed —`, err.message);
    failed++;
  }

  // 2. Rename Voice Profile in Solarch
  try {
    const updateRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records/${createdProfileId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Podcast Host Voice',
        projectId: 'test_proj_lib',
        userId: 'test_user_lib',
        speakerEmbedding: JSON.stringify([0.1, 0.2, 0.3])
      })
    });
    const updateData = await updateRes.json();

    if (updateRes.ok && updateData.name === 'Podcast Host Voice') {
      console.log(`[PASS] TEST-LIB-02: Voice Profile Renamed Successfully — ID: ${createdProfileId}, New Name: ${updateData.name}`);
      passed++;
    } else {
      throw new Error(`Rename failed: ${JSON.stringify(updateData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-LIB-02: Rename failed —`, err.message);
    failed++;
  }

  // 3. Synthesize Speech using the Renamed Profile
  try {
    const synthRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'test_proj_lib',
        user_id: 'test_user_lib',
        voice_profile_id: createdProfileId,
        text: 'Hello, this is a test from the renamed podcast voice.',
        model: 'xtts-v2',
        language: 'en'
      })
    });
    const synthData = await synthRes.json();

    if (synthRes.ok && synthData.status === 'COMPLETED') {
      console.log(`[PASS] TEST-LIB-03: Speech Generated with Renamed Profile — Audio: ${synthData.audio_path}`);
      passed++;
    } else {
      throw new Error(`Synthesis failed: ${JSON.stringify(synthData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-LIB-03: Synthesis failed —`, err.message);
    failed++;
  }

  // 4. Delete the Voice Profile from Solarch
  try {
    const delRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records/${createdProfileId}`, {
      method: 'DELETE'
    });

    if (delRes.status === 204 || delRes.ok) {
      console.log(`[PASS] TEST-LIB-04: Voice Profile Deleted from Solarch — ID: ${createdProfileId}`);
      passed++;
    } else {
      throw new Error(`Delete returned status ${delRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-LIB-04: Delete failed —`, err.message);
    failed++;
  }

  // 5. Verify Profile is No Longer Found
  try {
    const getRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records/${createdProfileId}`);
    if (getRes.status === 404) {
      console.log(`[PASS] TEST-LIB-05: Verified Record No Longer Exists in Solarch BaaS`);
      passed++;
    } else {
      throw new Error(`Expected 404, got ${getRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] TEST-LIB-05: Verification failed —`, err.message);
    failed++;
  }

  console.log('================================================================');
  console.log(`VOICE LIBRARY TESTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTest();
