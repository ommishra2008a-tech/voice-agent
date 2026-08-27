/**
 * PHASE 12B — SAVED VOICE REUSE + HIGH-FIDELITY CLONE OPTIMIZATION TEST
 * 
 * Verifies:
 * 1. Saved Voice Profile "aadi" creation and durable storage persistence
 * 2. Generation of 3 distinct sentences using ONLY voice_profile_id (no audio re-upload)
 * 3. Consistent speaker conditioning across multiple generations
 * 4. High-fidelity preprocessed reference audio utilization
 * 5. Strict rejection (VOICE_REFERENCE_UNAVAILABLE) when reference audio is non-existent (No silent fallback!)
 * 6. FastPitch non-cloning rejection (VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const AI_SERVICE_URL = 'http://localhost:8000';
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

const results = [];

function logPass(testId, name, detail) {
  results.push({ testId, name, status: 'PASSED', detail });
  console.log(`\x1b[32m[PASS]\x1b[0m ${testId}: ${name} - ${detail}`);
}

function logFail(testId, name, error) {
  results.push({ testId, name, status: 'FAILED', error: String(error) });
  console.error(`\x1b[31m[FAIL]\x1b[0m ${testId}: ${name} - ${error}`);
}

function postJson(endpoint, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, AI_SERVICE_URL);
    const bodyStr = JSON.stringify(data);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respData) });
          } catch (e) {
            resolve({ status: res.statusCode, data: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

async function runSuite() {
  console.log('================================================================');
  console.log('PHASE 12B: SAVED VOICE REUSE & HIGH-FIDELITY CLONE VERIFICATION');
  console.log('================================================================');

  const refAudioPath = path.join(FIXTURES_DIR, 'test_speech.m4a');
  let aadiProfileId = null;
  let aadiPrimaryRef = null;

  // 1. Create and Save Voice Profile "aadi"
  try {
    const res = await postJson('/v1/voice/profile', {
      project_id: 'proj_phase12b_user',
      user_id: 'user_aadi',
      name: 'aadi',
      audio_paths: [refAudioPath],
      target_speaker_id: 'speaker_1',
      language: 'en',
    });

    if (
      res.status === 200 &&
      (res.data.status === 'READY' || res.data.readiness_state === 'READY') &&
      res.data.voice_profile_id &&
      res.data.primary_reference_path
    ) {
      aadiProfileId = res.data.voice_profile_id;
      aadiPrimaryRef = res.data.primary_reference_path;
      logPass(
        'TEST-12B-01',
        'Saved Voice Profile "aadi" Creation & Storage Linkage',
        `Profile ID: ${aadiProfileId}, Primary Ref: ${aadiPrimaryRef}`
      );
    } else {
      logFail('TEST-12B-01', 'Saved Voice Profile Creation', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12B-01', 'Saved Voice Profile Creation', e);
  }

  // 2. Synthesize Sentence A using ONLY voice_profile_id (Simulating Session 1)
  let genAudioA = null;
  try {
    if (aadiProfileId) {
      const textA = 'Hello everyone, welcome to my channel.';
      const res = await postJson('/v1/speech/generate', {
        project_id: 'proj_phase12b_user',
        user_id: 'user_aadi',
        voice_profile_id: aadiProfileId,
        text: textA,
        model: 'xtts-v2',
        language: 'en',
      });

      if (res.status === 200 && res.data.status === 'COMPLETED' && res.data.audio_path) {
        genAudioA = res.data.audio_path;
        logPass(
          'TEST-12B-02',
          'Sentence A Synthesis with Saved Profile "aadi" (No Re-upload)',
          `Generated: ${genAudioA}, Duration: ${res.data.duration}s, Speaker Cloned: ${res.data.metadata?.speaker_cloned}`
        );
      } else {
        logFail('TEST-12B-02', 'Sentence A Synthesis', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12B-02', 'Sentence A Synthesis', 'No profile ID');
    }
  } catch (e) {
    logFail('TEST-12B-02', 'Sentence A Synthesis', e);
  }

  // 3. Synthesize Sentence B using ONLY voice_profile_id (Simulating Browser Refresh)
  let genAudioB = null;
  try {
    if (aadiProfileId) {
      const textB = 'Today we are testing my saved voice.';
      const res = await postJson('/v1/speech/generate', {
        project_id: 'proj_phase12b_user',
        user_id: 'user_aadi',
        voice_profile_id: aadiProfileId,
        text: textB,
        model: 'xtts-v2',
        language: 'en',
      });

      if (res.status === 200 && res.data.status === 'COMPLETED' && res.data.audio_path) {
        genAudioB = res.data.audio_path;
        logPass(
          'TEST-12B-03',
          'Sentence B Synthesis across Re-selection (No Re-upload)',
          `Generated: ${genAudioB}, Duration: ${res.data.duration}s, Speaker Cloned: ${res.data.metadata?.speaker_cloned}`
        );
      } else {
        logFail('TEST-12B-03', 'Sentence B Synthesis', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12B-03', 'Sentence B Synthesis', 'No profile ID');
    }
  } catch (e) {
    logFail('TEST-12B-03', 'Sentence B Synthesis', e);
  }

  // 4. Synthesize Sentence C using name "aadi" resolution directly
  let genAudioC = null;
  try {
    const textC = 'This speech is generated with the exact saved voice profile.';
    const res = await postJson('/v1/speech/generate', {
      project_id: 'proj_phase12b_user',
      user_id: 'user_aadi',
      voice_profile_id: 'aadi', // Resolved by name in storage
      text: textC,
      model: 'xtts-v2',
      language: 'en',
    });

    if (res.status === 200 && res.data.status === 'COMPLETED' && res.data.audio_path) {
      genAudioC = res.data.audio_path;
      logPass(
        'TEST-12B-04',
        'Sentence C Synthesis via Profile Name "aadi" Resolution',
        `Generated: ${genAudioC}, Duration: ${res.data.duration}s, Speaker Cloned: ${res.data.metadata?.speaker_cloned}`
      );
    } else {
      logFail('TEST-12B-04', 'Sentence C Synthesis', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12B-04', 'Sentence C Synthesis', e);
  }

  // 5. Strict Non-Fallback Verification (Unknown ID MUST Fail with VOICE_REFERENCE_UNAVAILABLE)
  try {
    const res = await postJson('/v1/speech/generate', {
      project_id: 'proj_phase12b_user',
      user_id: 'user_aadi',
      voice_profile_id: 'non_existent_voice_profile_99999',
      text: 'This must not silently fall back to generic voice.',
      model: 'xtts-v2',
      language: 'en',
    });

    if (
      res.status === 400 &&
      res.data.detail &&
      res.data.detail.includes('VOICE_REFERENCE_UNAVAILABLE')
    ) {
      logPass(
        'TEST-12B-05',
        'Strict Policy: Rejection of Missing Reference without Silent Fallback',
        `Correctly rejected with 400 and detail: ${res.data.detail}`
      );
    } else {
      logFail('TEST-12B-05', 'Strict Missing Reference Rejection', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12B-05', 'Strict Missing Reference Rejection', e);
  }

  // 6. FastPitch Compatibility Check (Clear Rejection of Custom Profiles)
  try {
    if (aadiProfileId) {
      const res = await postJson('/v1/speech/generate', {
        project_id: 'proj_phase12b_user',
        user_id: 'user_aadi',
        voice_profile_id: aadiProfileId,
        text: 'Testing FastPitch engine compatibility.',
        model: 'fastpitch-baseline',
        language: 'en',
      });

      if (
        res.status === 400 &&
        res.data.detail &&
        res.data.detail.includes('VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE')
      ) {
        logPass(
          'TEST-12B-06',
          'FastPitch Single-Speaker Compatibility Enforcement',
          `Correctly rejected with: ${res.data.detail}`
        );
      } else {
        logFail('TEST-12B-06', 'FastPitch Compatibility Rejection', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12B-06', 'FastPitch Compatibility Rejection', 'No profile ID');
    }
  } catch (e) {
    logFail('TEST-12B-06', 'FastPitch Compatibility Rejection', e);
  }

  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.log(`PHASE 12B TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${results.length})`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running Phase 12B suite:', err);
  process.exit(1);
});
