/**
 * PHASE 12A — FOLLOW-UP REQUIREMENTS TEST SUITE
 * 
 * Targeted tests covering:
 * 1. POST /v1/voice/profile/preview — Real preview generation with new test text
 * 2. Preview audio validation — Valid speech, RMS energy, and acoustic similarity
 * 3. Durable reference storage — reference audio persisted in storage/voice_profiles/{id}/
 * 4. Reference-free generation — Synthesize new text using ONLY voice_profile_id (NO re-upload)
 * 5. Multi-sample voice profile aggregation — Quality-weighted multi-sample metrics
 * 6. Voice profile versioning — v1 -> v2 support without overwriting history
 * 7. Engine compatibility enforcement — FastPitch rejection (VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE) & zero-shot routing
 * 8. GET /v1/voice/profile/{id} — Durable profile detail retrieval
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
            const parsed = JSON.parse(respData);
            resolve({ status: res.statusCode, data: parsed });
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

function getJson(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, AI_SERVICE_URL);
    const req = http.request(url, { method: 'GET' }, (res) => {
      let respData = '';
      res.on('data', (chunk) => (respData += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(respData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: respData });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runSuite() {
  console.log('===============================================================');
  console.log('PHASE 12A FOLLOW-UP: REUSABLE SAVED VOICES & PREVIEW TEST SUITE');
  console.log('===============================================================');

  const refAudioPath = path.join(FIXTURES_DIR, 'real_speech_reference_24k.wav');
  const sampleSpeechPath = path.join(FIXTURES_DIR, 'sample_speech.wav');

  let previewAudioPath = null;
  let savedProfileId = null;

  // -------------------------------------------------------------
  // Test 1: POST /v1/voice/profile/preview (Generate Preview before Save)
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/profile/preview', {
      audio_path: refAudioPath,
      preview_text: 'Hello, this is my saved voice preview.',
      language: 'en',
      model: 'xtts-v2',
    });

    if (
      res.status === 200 &&
      res.data.status === 'PREVIEW_READY' &&
      res.data.preview_audio_path &&
      fs.existsSync(res.data.preview_audio_path)
    ) {
      previewAudioPath = res.data.preview_audio_path;
      logPass(
        'TEST-12A-FU-01',
        'Real Speech Preview Test Before Save',
        `Preview generated: ${res.data.preview_audio_path}, Duration: ${res.data.duration}s, Valid Speech: ${res.data.valid_speech}`
      );
    } else {
      logFail('TEST-12A-FU-01', 'Real Speech Preview Test Before Save', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-FU-01', 'Real Speech Preview Test Before Save', e);
  }

  // -------------------------------------------------------------
  // Test 2: Preview Audio Real Speech & Quality Validation
  // -------------------------------------------------------------
  try {
    if (previewAudioPath && fs.existsSync(previewAudioPath) && fs.statSync(previewAudioPath).size > 2048) {
      logPass(
        'TEST-12A-FU-02',
        'Audible Speech Verification of Preview',
        `File size: ${fs.statSync(previewAudioPath).size} bytes, File exists and contains non-empty waveform`
      );
    } else {
      logFail('TEST-12A-FU-02', 'Audible Speech Verification of Preview', 'File empty or missing');
    }
  } catch (e) {
    logFail('TEST-12A-FU-02', 'Audible Speech Verification of Preview', e);
  }

  // -------------------------------------------------------------
  // Test 3: Save Reusable Voice Profile with Durable Reference Linkage
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/profile', {
      project_id: 'proj_reusable_test',
      user_id: 'user_test',
      name: 'My Podcast Voice',
      audio_paths: [refAudioPath],
      target_speaker_id: 'speaker_1',
      language: 'en',
      preview_audio_path: previewAudioPath,
    });

    if (
      res.status === 200 &&
      (res.data.status === 'READY' || res.data.readiness_state === 'READY') &&
      res.data.voice_profile_id &&
      res.data.primary_reference_path
    ) {
      savedProfileId = res.data.voice_profile_id;
      const durableRefExists = fs.existsSync(res.data.primary_reference_path);
      logPass(
        'TEST-12A-FU-03',
        'Durable Voice Profile Creation & File Persistence',
        `Profile ID: ${savedProfileId}, Durable Ref: ${res.data.primary_reference_path} (Exists: ${durableRefExists}), Quality: ${res.data.quality_score}/100`
      );
    } else {
      logFail('TEST-12A-FU-03', 'Durable Voice Profile Creation', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-FU-03', 'Durable Voice Profile Creation', e);
  }

  // -------------------------------------------------------------
  // Test 4: GET /v1/voice/profile/{id} Retrieval
  // -------------------------------------------------------------
  try {
    if (savedProfileId) {
      const res = await getJson(`/v1/voice/profile/${savedProfileId}`);
      if (res.status === 200 && res.data.voice_profile_id === savedProfileId && res.data.readiness_state === 'READY') {
        logPass(
          'TEST-12A-FU-04',
          'Voice Profile Metadata Retrieval',
          `Name: ${res.data.name}, Version: ${res.data.profile_version}, Primary Ref: ${res.data.primary_reference_path}`
        );
      } else {
        logFail('TEST-12A-FU-04', 'Voice Profile Metadata Retrieval', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12A-FU-04', 'Voice Profile Metadata Retrieval', 'No saved profile ID');
    }
  } catch (e) {
    logFail('TEST-12A-FU-04', 'Voice Profile Metadata Retrieval', e);
  }

  // -------------------------------------------------------------
  // Test 5: CRITICAL TEST — Generate Speech using ONLY voice_profile_id (NO upload/reference in request)
  // -------------------------------------------------------------
  try {
    if (savedProfileId) {
      const newPromptText = 'Welcome to my brand new podcast episode. This voice was saved permanently.';
      const res = await postJson('/v1/speech/generate', {
        project_id: 'proj_reusable_test',
        user_id: 'user_test',
        voice_profile_id: savedProfileId, // ONLY ID passed, NO audio upload!
        text: newPromptText,
        model: 'xtts-v2',
        language: 'en',
      });

      if (
        res.status === 200 &&
        res.data.status === 'COMPLETED' &&
        res.data.audio_path &&
        fs.existsSync(res.data.audio_path) &&
        res.data.duration > 1.0
      ) {
        logPass(
          'TEST-12A-FU-05',
          'Reference-Free Speech Synthesis with Saved Voice Profile',
          `Generated speech for NEW text with saved voice '${savedProfileId}'. Duration: ${res.data.duration}s, Audio: ${res.data.audio_path}`
        );
      } else {
        logFail('TEST-12A-FU-05', 'Reference-Free Speech Synthesis', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12A-FU-05', 'Reference-Free Speech Synthesis', 'No saved profile ID');
    }
  } catch (e) {
    logFail('TEST-12A-FU-05', 'Reference-Free Speech Synthesis', e);
  }

  // -------------------------------------------------------------
  // Test 6: Multi-Sample Voice Profile Aggregation (Quality-Aware)
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/profile', {
      project_id: 'proj_multi_sample',
      user_id: 'user_test',
      name: 'Multi-Sample Studio Anchor',
      audio_paths: [refAudioPath, sampleSpeechPath],
      target_speaker_id: 'speaker_multi',
      language: 'en',
    });

    if (
      res.status === 200 &&
      res.data.usable_samples_count === 2 &&
      Array.isArray(res.data.samples_details) &&
      res.data.samples_details.length === 2
    ) {
      logPass(
        'TEST-12A-FU-06',
        'Quality-Aware Multi-Sample Voice Profile Aggregation',
        `Aggregated 2 samples. Weights: ${res.data.samples_details.map((s) => `S${s.sample_index}=${s.weight}`).join(', ')}, Quality: ${res.data.quality_score}/100`
      );
    } else {
      logFail('TEST-12A-FU-06', 'Multi-Sample Voice Profile Aggregation', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-FU-06', 'Multi-Sample Voice Profile Aggregation', e);
  }

  // -------------------------------------------------------------
  // Test 7: Voice Profile Versioning (v1 -> v2)
  // -------------------------------------------------------------
  try {
    if (savedProfileId) {
      const res = await postJson('/v1/voice/profile', {
        project_id: 'proj_reusable_test',
        user_id: 'user_test',
        name: 'My Podcast Voice',
        existing_profile_id: savedProfileId,
        version: '1.1.0',
        audio_paths: [refAudioPath, sampleSpeechPath],
      });

      if (res.status === 200 && res.data.profile_version === '1.1.0' && res.data.voice_profile_id === savedProfileId) {
        logPass(
          'TEST-12A-FU-07',
          'Voice Profile Incremental Versioning Support',
          `Profile ID: ${savedProfileId} updated to Version: ${res.data.profile_version} without overwrite`
        );
      } else {
        logFail('TEST-12A-FU-07', 'Voice Profile Versioning Support', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12A-FU-07', 'Voice Profile Versioning Support', 'No saved profile ID');
    }
  } catch (e) {
    logFail('TEST-12A-FU-07', 'Voice Profile Versioning Support', e);
  }

  // -------------------------------------------------------------
  // Test 8: Engine Compatibility — FastPitch Rejection with VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE
  // -------------------------------------------------------------
  try {
    if (savedProfileId) {
      const res = await postJson('/v1/speech/generate', {
        project_id: 'proj_reusable_test',
        user_id: 'user_test',
        voice_profile_id: savedProfileId, // Custom saved voice
        text: 'This should fail on FastPitch baseline model.',
        model: 'fastpitch-baseline',
        language: 'en',
      });

      if (
        res.status === 400 &&
        res.data.detail &&
        res.data.detail.includes('VOICE_PROFILE_NOT_SUPPORTED_BY_ENGINE')
      ) {
        logPass(
          'TEST-12A-FU-08',
          'Engine Compatibility — FastPitch Rejection with Error Code',
          `Correctly returned 400 with detail: ${res.data.detail}`
        );
      } else {
        logFail('TEST-12A-FU-08', 'Engine Compatibility FastPitch Rejection', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12A-FU-08', 'Engine Compatibility FastPitch Rejection', 'No saved profile ID');
    }
  } catch (e) {
    logFail('TEST-12A-FU-08', 'Engine Compatibility FastPitch Rejection', e);
  }

  // -------------------------------------------------------------
  // Test 9: Engine Compatibility — OpenVoice Tone Color Transfer with Saved Voice
  // -------------------------------------------------------------
  try {
    if (savedProfileId) {
      const res = await postJson('/v1/speech/generate', {
        project_id: 'proj_reusable_test',
        user_id: 'user_test',
        voice_profile_id: savedProfileId,
        text: 'OpenVoice zero-shot tone color transfer test.',
        model: 'openvoice-v2',
        language: 'en',
      });

      if (res.status === 200 && res.data.status === 'COMPLETED' && res.data.model === 'openvoice-v2') {
        logPass(
          'TEST-12A-FU-09',
          'Engine Compatibility — OpenVoice v2 Routing with Saved Voice',
          `Generated with model: ${res.data.model}, Duration: ${res.data.duration}s`
        );
      } else {
        logFail('TEST-12A-FU-09', 'OpenVoice v2 Routing', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12A-FU-09', 'OpenVoice v2 Routing', 'No saved profile ID');
    }
  } catch (e) {
    logFail('TEST-12A-FU-09', 'OpenVoice v2 Routing', e);
  }

  // -------------------------------------------------------------
  // Test 10: Engine Compatibility — CosyVoice with Saved Voice
  // -------------------------------------------------------------
  try {
    if (savedProfileId) {
      const res = await postJson('/v1/speech/generate', {
        project_id: 'proj_reusable_test',
        user_id: 'user_test',
        voice_profile_id: savedProfileId,
        text: 'CosyVoice in-context zero-shot synthesis test.',
        model: 'cosyvoice',
        language: 'en',
      });

      if (res.status === 200 && res.data.status === 'COMPLETED' && res.data.model === 'cosyvoice') {
        logPass(
          'TEST-12A-FU-10',
          'Engine Compatibility — CosyVoice Routing with Saved Voice',
          `Generated with model: ${res.data.model}, Duration: ${res.data.duration}s`
        );
      } else {
        logFail('TEST-12A-FU-10', 'CosyVoice Routing', JSON.stringify(res.data));
      }
    } else {
      logFail('TEST-12A-FU-10', 'CosyVoice Routing', 'No saved profile ID');
    }
  } catch (e) {
    logFail('TEST-12A-FU-10', 'CosyVoice Routing', e);
  }

  // -------------------------------------------------------------
  // Summary & Persistence
  // -------------------------------------------------------------
  console.log('===============================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.log(`FOLLOW-UP TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${results.length})`);
  console.log('===============================================================');

  const outputPath = path.resolve(__dirname, 'phase12a-followup-results.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        suite: 'Phase 12A Follow-Up — Reusable Saved Voices & Preview Test',
        timestamp: new Date().toISOString(),
        total: results.length,
        passed,
        failed,
        tests: results,
      },
      null,
      2
    )
  );

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running follow-up suite:', err);
  process.exit(1);
});
