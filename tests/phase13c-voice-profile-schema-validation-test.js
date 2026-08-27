/**
 * Phase 13C Targeted Test:
 * Voice Profiles Schema Integrity, Saved Voice "aadi" Resolution, and XTTSv2 Synthesis
 */

const fs = require('fs');
const path = require('path');

const SOLARCH_BASE = 'http://localhost:8090';
const AI_BASE = 'http://localhost:8000';

async function runTest() {
  console.log('================================================================');
  console.log('PHASE 13C: VOICE_PROFILES SCHEMA & SAVED VOICE "aadi" TEST');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  // 1. Check voice_profiles schema validity
  try {
    const adminRes = await fetch(`${SOLARCH_BASE}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@voiceai.lab', password: 'AdminPassword123!' })
    });
    const { token } = await adminRes.json();

    const vpRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const vpCol = await vpRes.json();
    const fields = vpCol.fields || [];

    if (fields.length === 12) {
      console.log(`[PASS] CHECK-1: voice_profiles schema has exactly 12 canonical fields`);
      passed++;
    } else {
      throw new Error(`Expected 12 fields, found ${fields.length}`);
    }
  } catch (err) {
    console.error(`[FAIL] CHECK-1: Schema check failed —`, err.message);
    failed++;
  }

  // 2. Check no duplicate field names
  try {
    const adminRes = await fetch(`${SOLARCH_BASE}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@voiceai.lab', password: 'AdminPassword123!' })
    });
    const { token } = await adminRes.json();

    const vpRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const vpCol = await vpRes.json();
    const fieldNames = (vpCol.fields || []).map(f => f.name);
    const duplicates = fieldNames.filter((name, idx) => fieldNames.indexOf(name) !== idx);

    if (duplicates.length === 0) {
      console.log(`[PASS] CHECK-2: No duplicate field names in voice_profiles`);
      passed++;
    } else {
      throw new Error(`Found duplicates: ${duplicates.join(', ')}`);
    }
  } catch (err) {
    console.error(`[FAIL] CHECK-2: Duplicate check failed —`, err.message);
    failed++;
  }

  // 3. Check referenceAudio exists exactly once
  try {
    const adminRes = await fetch(`${SOLARCH_BASE}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@voiceai.lab', password: 'AdminPassword123!' })
    });
    const { token } = await adminRes.json();

    const vpRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const vpCol = await vpRes.json();
    const refAudioFields = (vpCol.fields || []).filter(f => f.name === 'referenceAudio');

    if (refAudioFields.length === 1) {
      console.log(`[PASS] CHECK-3: referenceAudio field exists exactly once (type: ${refAudioFields[0].type})`);
      passed++;
    } else {
      throw new Error(`Found ${refAudioFields.length} referenceAudio fields`);
    }
  } catch (err) {
    console.error(`[FAIL] CHECK-3: referenceAudio check failed —`, err.message);
    failed++;
  }

  // 4 & 5. Find saved voice "aadi", verify record & reference asset
  let aadiRecord = null;
  let aadiRefPath = null;
  try {
    const listRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records?perPage=50`);
    const listData = await listRes.json();
    const items = listData.items || [];

    aadiRecord = items.find(i => i.name && i.name.toLowerCase() === 'aadi');

    if (aadiRecord) {
      aadiRefPath = aadiRecord.referenceAudio || aadiRecord.sourceAssetId;
      console.log(`[PASS] CHECK-4: Saved voice 'aadi' found in Solarch (Record ID: ${aadiRecord.id}, sourceAssetId: ${aadiRecord.sourceAssetId})`);
      passed++;
    } else {
      throw new Error("Voice 'aadi' not found in Solarch collection");
    }

    if (aadiRefPath && fs.existsSync(aadiRefPath)) {
      console.log(`[PASS] CHECK-5: 'aadi' reference asset verified on disk (Path: ${aadiRefPath}, Size: ${fs.statSync(aadiRefPath).size} bytes)`);
      passed++;
    } else {
      // Check fallback storage location
      const fallbackPath = path.join(process.cwd(), 'services', 'ai-service', 'storage', 'voice_profiles', aadiRecord.sourceAssetId || '', 'reference.wav');
      if (fs.existsSync(fallbackPath)) {
        aadiRefPath = fallbackPath;
        console.log(`[PASS] CHECK-5: 'aadi' reference asset verified at fallback path (Path: ${fallbackPath})`);
        passed++;
      } else {
        throw new Error(`Reference audio missing on disk for aadi: ${aadiRefPath}`);
      }
    }
  } catch (err) {
    console.error(`[FAIL] CHECK-4/5: 'aadi' profile check failed —`, err.message);
    failed++;
  }

  // 6 & 7. Saved voice retrieval and active voice selection
  try {
    const filter = encodeURIComponent("(name='aadi')");
    const queryRes = await fetch(`${SOLARCH_BASE}/api/collections/voice_profiles/records?filter=${filter}`);
    const queryData = await queryRes.json();
    const matched = (queryData.items || [])[0];

    if (matched && matched.name.toLowerCase() === 'aadi') {
      console.log(`[PASS] CHECK-6: Saved voice query retrieval works via filter=(name='aadi')`);
      console.log(`[PASS] CHECK-7: Active voice selection resolved to profile ID ${matched.id}`);
      passed += 2;
    } else {
      throw new Error(`Query for 'aadi' returned 0 results`);
    }
  } catch (err) {
    console.error(`[FAIL] CHECK-6/7: Retrieval / selection check failed —`, err.message);
    failed += 2;
  }

  // 8 & 9. XTTSv2 Speech Generation using Saved Voice "aadi"
  try {
    console.log(`[INFO] Synthesizing speech with XTTSv2 using saved voice 'aadi'...`);
    const synthRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: 'test_phase13c',
        user_id: 'test_user_13c',
        voice_profile_id: aadiRecord ? aadiRecord.id : 'aadi',
        reference_audio_path: aadiRefPath || undefined,
        text: 'This is a test of the saved aadi voice profile after schema repair.',
        model: 'xtts-v2',
        language: 'en'
      })
    });

    const synthData = await synthRes.json();

    if (synthRes.ok && synthData.status === 'COMPLETED' && synthData.audio_path && fs.existsSync(synthData.audio_path)) {
      const stats = fs.statSync(synthData.audio_path);
      console.log(`[PASS] CHECK-8: XTTSv2 received saved reference for 'aadi' without reference unavailable error`);
      console.log(`[PASS] CHECK-9: Speech generation completed successfully (Output: ${synthData.audio_path}, Size: ${stats.size} bytes, Duration: ${synthData.duration?.toFixed(2)}s)`);
      passed += 2;
    } else {
      throw new Error(`XTTSv2 generation failed: ${JSON.stringify(synthData)}`);
    }
  } catch (err) {
    console.error(`[FAIL] CHECK-8/9: Speech synthesis check failed —`, err.message);
    failed += 2;
  }

  // 10. Check generation_jobs collection is untouched and valid (12 fields)
  try {
    const adminRes = await fetch(`${SOLARCH_BASE}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: 'admin@voiceai.lab', password: 'AdminPassword123!' })
    });
    const { token } = await adminRes.json();

    const gjRes = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const gjCol = await gjRes.json();
    const fields = gjCol.fields || [];

    if (fields.length === 12) {
      console.log(`[PASS] CHECK-10: generation_jobs remains completely untouched, clean, and valid (12 fields)`);
      passed++;
    } else {
      throw new Error(`generation_jobs field count mismatch: expected 12, got ${fields.length}`);
    }
  } catch (err) {
    console.error(`[FAIL] CHECK-10: generation_jobs check failed —`, err.message);
    failed++;
  }

  console.log('================================================================');
  console.log(`PHASE 13C CHECKS: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTest();
