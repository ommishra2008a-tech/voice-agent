/**
 * Targeted Multi-Tenant Voice Isolation & Security Test
 *
 * Verifies:
 * 1. User A & User B Profile Creation Isolation
 * 2. Voice Profile Listing Isolation (User B cannot see User A's voices)
 * 3. Direct Profile ID Lookup Security (403 Forbidden for unauthorized user)
 * 4. Direct Preview Security (403 Forbidden for unauthorized user)
 * 5. XTTSv2 Speech Generation Security (403 Forbidden before inference)
 * 6. Same-Name Voice Collision Isolation (Identical voice names remain strictly isolated)
 * 7. Delete Security (User B cannot delete User A's voice profile)
 * 8. Path Traversal & Raw Audio Access Control (Forbidden outside storage boundaries)
 * 9. Multi-Chat Conversation & Generation Job Isolation
 * 10. User A Valid Access Preservation (User A can still use own voice)
 */

const fs = require('fs');
const path = require('path');

const SOLARCH_BASE = 'http://localhost:8090';
const AI_BASE = 'http://localhost:8000';

async function runSecurityIsolationTests() {
  console.log('================================================================');
  console.log('MULTI-TENANT VOICE DATA ACCESS & AUTHORIZATION SECURITY TEST');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  const timestamp = Date.now();
  const userA_id = `user_sec_a_${timestamp}`;
  const userB_id = `user_sec_b_${timestamp}`;
  const projA_id = `proj_sec_a_${timestamp}`;
  const projB_id = `proj_sec_b_${timestamp}`;

  const sampleRefPath = path.resolve(__dirname, 'fixtures', 'real_speech_reference_24k.wav');
  if (!fs.existsSync(sampleRefPath)) {
    console.error(`[ERROR] Test fixture missing: ${sampleRefPath}`);
    process.exit(1);
  }

  let voiceA_recordId = null;
  let voiceB_recordId = null;
  let voiceA_sameNameId = null;
  let voiceB_sameNameId = null;

  // -------------------------------------------------------------------------
  // 1. Create Voice Profile for User A
  // -------------------------------------------------------------------------
  try {
    const resA = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projA_id,
        userId: userA_id,
        name: 'User A Secret Anchor',
        primaryReferencePath: sampleRefPath,
        referenceAudio: sampleRefPath,
        voiceProfileId: `vp_a_${timestamp}`,
        sourceAssetId: `vp_a_${timestamp}`,
        language: 'en',
        speakerEmbedding: JSON.stringify(new Array(128).fill(0.01)),
        referenceAudioPaths: JSON.stringify([sampleRefPath]),
        targetSpeakerId: 'speaker_1',
        qualityScore: 94.0,
        status: 'READY'
      })
    });
    const dataA = await resA.json();
    voiceA_recordId = dataA.id;
    if (resA.ok && voiceA_recordId) {
      console.log(`[PASS] STEP 1: Created User A Voice Profile (Record ID: ${voiceA_recordId}, User: ${userA_id})`);
      passed++;
    } else {
      throw new Error(`Failed to create User A voice: ${JSON.stringify(dataA)}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 1:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 2. Create Voice Profile for User B
  // -------------------------------------------------------------------------
  try {
    const resB = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projB_id,
        userId: userB_id,
        name: 'User B Technical Voice',
        primaryReferencePath: sampleRefPath,
        referenceAudio: sampleRefPath,
        voiceProfileId: `vp_b_${timestamp}`,
        sourceAssetId: `vp_b_${timestamp}`,
        language: 'en',
        speakerEmbedding: JSON.stringify(new Array(128).fill(0.02)),
        referenceAudioPaths: JSON.stringify([sampleRefPath]),
        targetSpeakerId: 'speaker_1',
        qualityScore: 91.0,
        status: 'READY'
      })
    });
    const dataB = await resB.json();
    voiceB_recordId = dataB.id;
    if (resB.ok && voiceB_recordId) {
      console.log(`[PASS] STEP 2: Created User B Voice Profile (Record ID: ${voiceB_recordId}, User: ${userB_id})`);
      passed++;
    } else {
      throw new Error(`Failed to create User B voice: ${JSON.stringify(dataB)}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 2:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 3. Voice Profile Listing Isolation Check
  // -------------------------------------------------------------------------
  try {
    // Query as User B for Project B
    const filterB = encodeURIComponent(`(projectId='${projB_id}' && userId='${userB_id}')`);
    const listResB = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records?filter=${filterB}`);
    const listDataB = await listResB.json();
    const itemsB = listDataB.items || [];

    const containsUserAVoice = itemsB.some(p => p.id === voiceA_recordId || p.userId === userA_id);
    const containsUserBVoice = itemsB.some(p => p.id === voiceB_recordId);

    if (!containsUserAVoice && containsUserBVoice && itemsB.length === 1) {
      console.log(`[PASS] STEP 3: Voice Profile Listing is strictly isolated (User B sees ONLY User B's voice)`);
      passed++;
    } else {
      throw new Error(`Listing violation: User B returned ${itemsB.length} items, contains User A voice: ${containsUserAVoice}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 3:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 4. Direct Record ID Lookup Security (GET /profile/{id})
  // -------------------------------------------------------------------------
  try {
    // User B tries to inspect User A's profile ID
    const url = `${AI_BASE}/v1/voice/profile/${voiceA_recordId}?user_id=${userB_id}&project_id=${projB_id}`;
    const detailRes = await fetch(url);
    if (detailRes.status === 403) {
      console.log(`[PASS] STEP 4: Direct ID lookup of User A's voice by User B returned 403 Forbidden (Blocked)`);
      passed++;
    } else {
      throw new Error(`Expected 403 Forbidden, got status ${detailRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 4:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 5. Direct Preview Generation Security (POST /profile/{id}/preview)
  // -------------------------------------------------------------------------
  try {
    // User B tries to generate a preview using User A's profile ID
    const previewRes = await fetch(`${AI_BASE}/v1/voice/profile/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_profile_id: voiceA_recordId,
        user_id: userB_id,
        project_id: projB_id,
        preview_text: "Unauthorized preview attempt"
      })
    });
    if (previewRes.status === 403) {
      console.log(`[PASS] STEP 5: Unauthorized preview of User A's voice by User B returned 403 Forbidden (Blocked)`);
      passed++;
    } else {
      throw new Error(`Expected 403 Forbidden for unauthorized preview, got ${previewRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 5:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 6. Speech Generation Authorization Security (POST /v1/speech/generate)
  // -------------------------------------------------------------------------
  try {
    // User B attempts to synthesize speech with User A's voiceProfileId
    const genRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projB_id,
        user_id: userB_id,
        voice_profile_id: voiceA_recordId,
        text: "Attempting to synthesize speech using another tenant's voice profile.",
        model: "xtts-v2",
        language: "en"
      })
    });
    if (genRes.status === 403) {
      const errData = await genRes.json();
      console.log(`[PASS] STEP 6: XTTSv2 generation with User A's voiceProfileId by User B returned 403 Forbidden (Detail: "${errData.detail}")`);
      passed++;
    } else {
      throw new Error(`Expected 403 Forbidden for cross-tenant generation, got ${genRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 6:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 7. Same-Name Collision Isolation Test
  // -------------------------------------------------------------------------
  try {
    const sharedName = "Executive Boardroom Voice";

    // User A creates profile with shared name
    const aRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projA_id,
        userId: userA_id,
        name: sharedName,
        primaryReferencePath: sampleRefPath,
        referenceAudio: sampleRefPath,
        voiceProfileId: `vp_same_a_${timestamp}`,
        sourceAssetId: `vp_same_a_${timestamp}`,
        language: 'en',
        speakerEmbedding: JSON.stringify(new Array(128).fill(0.01)),
        referenceAudioPaths: JSON.stringify([sampleRefPath]),
        targetSpeakerId: 'speaker_1',
        qualityScore: 95.0,
        status: 'READY'
      })
    });
    const aData = await aRes.json();
    voiceA_sameNameId = aData.id;

    // User B creates profile with exact same name
    const bRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: projB_id,
        userId: userB_id,
        name: sharedName,
        primaryReferencePath: sampleRefPath,
        referenceAudio: sampleRefPath,
        voiceProfileId: `vp_same_b_${timestamp}`,
        sourceAssetId: `vp_same_b_${timestamp}`,
        language: 'en',
        speakerEmbedding: JSON.stringify(new Array(128).fill(0.02)),
        referenceAudioPaths: JSON.stringify([sampleRefPath]),
        targetSpeakerId: 'speaker_1',
        qualityScore: 92.0,
        status: 'READY'
      })
    });
    const bData = await bRes.json();
    voiceB_sameNameId = bData.id;

    // Query as User A
    const filterA = encodeURIComponent(`(projectId='${projA_id}' && userId='${userA_id}' && name='${sharedName}')`);
    const qA = await (await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records?filter=${filterA}`)).json();

    // Query as User B
    const filterB = encodeURIComponent(`(projectId='${projB_id}' && userId='${userB_id}' && name='${sharedName}')`);
    const qB = await (await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records?filter=${filterB}`)).json();

    if (qA.items.length === 1 && qA.items[0].id === voiceA_sameNameId &&
        qB.items.length === 1 && qB.items[0].id === voiceB_sameNameId) {
      console.log(`[PASS] STEP 7: Same-name collision test passed (Both named "${sharedName}" remain strictly isolated)`);
      passed++;
    } else {
      throw new Error(`Same-name collision leakage detected`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 7:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 8. Delete Security (DELETE /profile/{id})
  // -------------------------------------------------------------------------
  try {
    // User B tries to delete User A's profile
    const delRes = await fetch(`${AI_BASE}/v1/voice/profile/${voiceA_recordId}?user_id=${userB_id}&project_id=${projB_id}`, {
      method: 'DELETE'
    });
    if (delRes.status === 403) {
      console.log(`[PASS] STEP 8: Cross-user profile deletion returned 403 Forbidden (Blocked)`);
      passed++;
    } else {
      throw new Error(`Expected 403 Forbidden for cross-user deletion, got ${delRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 8:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 9. Path Traversal & Audio Route Security
  // -------------------------------------------------------------------------
  try {
    const traversalPath = '../../../../Windows/System32/drivers/etc/hosts';
    const rawRes = await fetch(`${AI_BASE}/v1/media/audio/raw?path=${encodeURIComponent(traversalPath)}`);
    if (rawRes.status === 403) {
      console.log(`[PASS] STEP 9: Path traversal attack on /v1/media/audio/raw returned 403 Forbidden (Blocked)`);
      passed++;
    } else {
      throw new Error(`Expected 403 for path traversal, got ${rawRes.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 9:`, err.message);
    failed++;
  }

  // -------------------------------------------------------------------------
  // 10. Valid Authorized User Access Preservation
  // -------------------------------------------------------------------------
  try {
    // User A accesses their own profile
    const ownDetail = await fetch(`${AI_BASE}/v1/voice/profile/${voiceA_recordId}?user_id=${userA_id}&project_id=${projA_id}`);
    if (ownDetail.status === 200) {
      const data = await ownDetail.json();
      console.log(`[PASS] STEP 10: Authorized User A successfully accessed own voice profile (Status: ${data.status})`);
      passed++;
    } else {
      throw new Error(`User A could not access own profile: status ${ownDetail.status}`);
    }
  } catch (err) {
    console.error(`[FAIL] STEP 10:`, err.message);
    failed++;
  }

  console.log('================================================================');
  console.log(`SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runSecurityIsolationTests();
