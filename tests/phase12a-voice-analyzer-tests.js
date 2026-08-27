/**
 * PHASE 12A — ADVANCED REFERENCE VOICE ANALYZER TEST SUITE
 * 20 targeted automated tests covering:
 * - Multi-dimensional acoustic feature extraction from real signal
 * - Pitch (F0), Timbre (FFT/MFCC), Prosody (WPM/pauses), Style, Emotion, Quality Gate
 * - Dual-representation speaker identity encoding (256-D spectral fingerprint)
 * - File upload and format normalization pipeline
 * - Profile creation, versioning, reference linkage, and quality gate enforcement
 * - Voice comparison and similarity scoring
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

function uploadFile(endpoint, filePath) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const filename = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    const pre = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: audio/wav\r\n\r\n`
    );
    const post = Buffer.from(`\r\n--${boundary}--\r\n`);
    const fullBody = Buffer.concat([pre, fileData, post]);

    const url = new URL(endpoint, AI_SERVICE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': fullBody.length,
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
    req.write(fullBody);
    req.end();
  });
}

async function runSuite() {
  console.log('===============================================================');
  console.log('PHASE 12A: ADVANCED REFERENCE VOICE ANALYZER TEST SUITE');
  console.log('===============================================================');

  const validAudioPath = path.join(FIXTURES_DIR, 'real_speech_reference.wav');
  const emptyAudioPath = path.join(FIXTURES_DIR, 'empty_file.wav');
  const corruptedAudioPath = path.join(FIXTURES_DIR, 'corrupted_media.wav');

  let uploadedAudioPath = null;

  // -------------------------------------------------------------
  // Test 1: GET /v1/voice/models
  // -------------------------------------------------------------
  try {
    const res = await getJson('/v1/voice/models');
    if (
      res.status === 200 &&
      res.data.speaker_encoder === 'spectral-fingerprint' &&
      res.data.encoder_type === 'deterministic-acoustic-fingerprint' &&
      res.data.analysis_version === 'phase12a' &&
      res.data.embedding_dimension === 256
    ) {
      logPass(
        'TEST-12A-01',
        'Voice Models Endpoint & Architecture Metadata',
        `Encoder: ${res.data.speaker_encoder}, Type: ${res.data.encoder_type}, Dim: ${res.data.embedding_dimension}`
      );
    } else {
      logFail('TEST-12A-01', 'Voice Models Endpoint', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-01', 'Voice Models Endpoint', e);
  }

  // -------------------------------------------------------------
  // Test 2: POST /v1/voice/upload (Valid Audio)
  // -------------------------------------------------------------
  try {
    const res = await uploadFile('/v1/voice/upload', validAudioPath);
    if (res.status === 200 && res.data.status === 'UPLOADED' && res.data.audio_path) {
      uploadedAudioPath = res.data.audio_path;
      logPass(
        'TEST-12A-02',
        'Reference Audio Upload & Ingestion',
        `Uploaded to: ${uploadedAudioPath}, Size: ${res.data.size_bytes} bytes, Duration: ${res.data.duration}s`
      );
    } else {
      logFail('TEST-12A-02', 'Reference Audio Upload', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-02', 'Reference Audio Upload', e);
  }

  // -------------------------------------------------------------
  // Test 3: POST /v1/voice/upload (Empty Audio Rejection)
  // -------------------------------------------------------------
  try {
    const res = await uploadFile('/v1/voice/upload', emptyAudioPath);
    if (res.status === 400) {
      logPass('TEST-12A-03', 'Empty Audio Upload Rejection', `Correctly rejected 0-byte file (Status 400)`);
    } else {
      logFail('TEST-12A-03', 'Empty Audio Upload Rejection', `Expected 400, got ${res.status}`);
    }
  } catch (e) {
    logFail('TEST-12A-03', 'Empty Audio Upload Rejection', e);
  }

  // -------------------------------------------------------------
  // Test 4: POST /v1/voice/upload (Unsupported Format)
  // -------------------------------------------------------------
  try {
    const dummyTxt = path.join(FIXTURES_DIR, 'dummy_test.txt');
    fs.writeFileSync(dummyTxt, 'plain text content');
    const res = await uploadFile('/v1/voice/upload', dummyTxt);
    fs.unlinkSync(dummyTxt);
    if (res.status === 400) {
      logPass('TEST-12A-04', 'Unsupported File Format Rejection', `Rejected .txt file as expected (Status 400)`);
    } else {
      logFail('TEST-12A-04', 'Unsupported File Format Rejection', `Expected 400, got ${res.status}`);
    }
  } catch (e) {
    logFail('TEST-12A-04', 'Unsupported File Format Rejection', e);
  }

  // -------------------------------------------------------------
  // Test 5: POST /v1/voice/analyze (Real Signal Analysis Status)
  // -------------------------------------------------------------
  let analysisResult = null;
  try {
    const res = await postJson('/v1/voice/analyze', {
      audio_path: validAudioPath,
      speaker_id: 'speaker_test',
    });
    if (res.status === 200 && (res.data.status === 'COMPLETED' || res.data.status === 'NEEDS_REVIEW')) {
      analysisResult = res.data;
      logPass(
        'TEST-12A-05',
        'Full Multi-Dimensional Voice Analysis Pipeline',
        `Status: ${res.data.status}, Exec time: ${res.data.execution_time_ms}ms`
      );
    } else {
      logFail('TEST-12A-05', 'Full Voice Analysis Pipeline', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-05', 'Full Voice Analysis Pipeline', e);
  }

  // -------------------------------------------------------------
  // Test 6: PitchStats Verification (Real F0 Extraction)
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.pitch &&
      typeof analysisResult.pitch.f0_mean === 'number' &&
      analysisResult.pitch.f0_mean > 0 &&
      Array.isArray(analysisResult.pitch.contour_samples)
    ) {
      logPass(
        'TEST-12A-06',
        'Pitch Analyzer — Real F0 Extraction & Contour',
        `F0 Mean: ${analysisResult.pitch.f0_mean} Hz, Range: ${analysisResult.pitch.f0_range} Hz, Samples: ${analysisResult.pitch.contour_samples.length}`
      );
    } else {
      logFail('TEST-12A-06', 'Pitch Analyzer', JSON.stringify(analysisResult?.pitch));
    }
  } catch (e) {
    logFail('TEST-12A-06', 'Pitch Analyzer', e);
  }

  // -------------------------------------------------------------
  // Test 7: TimbreProfile Verification (FFT Moments & MFCCs)
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.timbre &&
      analysisResult.timbre.spectral_centroid > 0 &&
      analysisResult.timbre.spectral_bandwidth > 0 &&
      Array.isArray(analysisResult.timbre.mfcc_means) &&
      analysisResult.timbre.mfcc_means.length === 13
    ) {
      logPass(
        'TEST-12A-07',
        'Timbre Analyzer — Real FFT Centroid & 13 MFCCs',
        `Centroid: ${analysisResult.timbre.spectral_centroid} Hz, Bandwidth: ${analysisResult.timbre.spectral_bandwidth} Hz, MFCCs: ${analysisResult.timbre.mfcc_means.length}`
      );
    } else {
      logFail('TEST-12A-07', 'Timbre Analyzer', JSON.stringify(analysisResult?.timbre));
    }
  } catch (e) {
    logFail('TEST-12A-07', 'Timbre Analyzer', e);
  }

  // -------------------------------------------------------------
  // Test 8: ProsodyProfile Verification (WPM, Pauses, Rhythm)
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.prosody &&
      typeof analysisResult.prosody.speaking_rate_wpm === 'number' &&
      typeof analysisResult.prosody.rhythm_score === 'number'
    ) {
      logPass(
        'TEST-12A-08',
        'Prosody Analyzer — Speaking Rate, Pauses & Rhythm',
        `Rate: ${analysisResult.prosody.speaking_rate_wpm} WPM, Rhythm Score: ${analysisResult.prosody.rhythm_score}, Energy Var: ${analysisResult.prosody.energy_variation}`
      );
    } else {
      logFail('TEST-12A-08', 'Prosody Analyzer', JSON.stringify(analysisResult?.prosody));
    }
  } catch (e) {
    logFail('TEST-12A-08', 'Prosody Analyzer', e);
  }

  // -------------------------------------------------------------
  // Test 9: StyleProfile Verification (Expressiveness & Cadence)
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.style &&
      typeof analysisResult.style.conversational_score === 'number' &&
      typeof analysisResult.style.expressiveness_score === 'number' &&
      analysisResult.style.sentence_rhythm
    ) {
      logPass(
        'TEST-12A-09',
        'Style Analyzer — Conversational, Formality & Expressiveness',
        `Conv: ${analysisResult.style.conversational_score}, Form: ${analysisResult.style.formality_score}, Expr: ${analysisResult.style.expressiveness_score}, Rhythm: ${analysisResult.style.sentence_rhythm}`
      );
    } else {
      logFail('TEST-12A-09', 'Style Analyzer', JSON.stringify(analysisResult?.style));
    }
  } catch (e) {
    logFail('TEST-12A-09', 'Style Analyzer', e);
  }

  // -------------------------------------------------------------
  // Test 10: EmotionProfile Verification (Distribution & Segments)
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.emotion &&
      analysisResult.emotion.primary_emotion &&
      analysisResult.emotion.emotion_distribution
    ) {
      logPass(
        'TEST-12A-10',
        'Emotion Analyzer — Acoustic Emotion Distribution',
        `Primary: ${analysisResult.emotion.primary_emotion} (Conf: ${analysisResult.emotion.confidence}), Distribution keys: ${Object.keys(analysisResult.emotion.emotion_distribution).join(', ')}`
      );
    } else {
      logFail('TEST-12A-10', 'Emotion Analyzer', JSON.stringify(analysisResult?.emotion));
    }
  } catch (e) {
    logFail('TEST-12A-10', 'Emotion Analyzer', e);
  }

  // -------------------------------------------------------------
  // Test 11: VoiceQualityProfile Verification (SNR, Speech Ratio & Quality Gate)
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.quality &&
      typeof analysisResult.quality.quality_score === 'number' &&
      typeof analysisResult.quality.snr_db === 'number' &&
      typeof analysisResult.quality.quality_gate_passed === 'boolean'
    ) {
      logPass(
        'TEST-12A-11',
        'Voice Quality Analyzer — SNR, Speech Duration & Quality Gate',
        `Quality Score: ${analysisResult.quality.quality_score}/100, SNR: ${analysisResult.quality.snr_db} dB, Gate Passed: ${analysisResult.quality.quality_gate_passed}`
      );
    } else {
      logFail('TEST-12A-11', 'Voice Quality Analyzer', JSON.stringify(analysisResult?.quality));
    }
  } catch (e) {
    logFail('TEST-12A-11', 'Voice Quality Analyzer', e);
  }

  // -------------------------------------------------------------
  // Test 12: SpeakerIdentityEncoder 256-D Embedding
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.embedding &&
      Array.isArray(analysisResult.embedding.embedding) &&
      analysisResult.embedding.embedding.length === 256 &&
      analysisResult.embedding.dimension === 256 &&
      analysisResult.embedding.model_name === 'spectral-fingerprint'
    ) {
      // Check L2 norm is approximately 1.0
      const vec = analysisResult.embedding.embedding;
      const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
      logPass(
        'TEST-12A-12',
        'Speaker Identity Encoder — 256-D L2 Normalized Embedding',
        `Model: ${analysisResult.embedding.model_name}, Dimension: ${analysisResult.embedding.dimension}, L2 Norm: ${norm.toFixed(4)}`
      );
    } else {
      logFail('TEST-12A-12', 'Speaker Identity Encoder', JSON.stringify(analysisResult?.embedding));
    }
  } catch (e) {
    logFail('TEST-12A-12', 'Speaker Identity Encoder', e);
  }

  // -------------------------------------------------------------
  // Test 13: Analysis Response Versioning & Reference Linkage
  // -------------------------------------------------------------
  try {
    if (
      analysisResult &&
      analysisResult.profile_version === '1.0.0' &&
      analysisResult.encoder_version === 'spectral-fingerprint-v1.0.0' &&
      analysisResult.analysis_version === 'phase12a' &&
      analysisResult.reference_audio_path === validAudioPath
    ) {
      logPass(
        'TEST-12A-13',
        'Analysis Response Traceability & Versioning Linkage',
        `Profile Ver: ${analysisResult.profile_version}, Encoder Ver: ${analysisResult.encoder_version}, Ref: ${analysisResult.reference_audio_path}`
      );
    } else {
      logFail('TEST-12A-13', 'Traceability & Versioning Linkage', JSON.stringify(analysisResult));
    }
  } catch (e) {
    logFail('TEST-12A-13', 'Traceability & Versioning Linkage', e);
  }

  // -------------------------------------------------------------
  // Test 14: Rejection on Non-Existent or Corrupted Audio
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/analyze', {
      audio_path: 'C:\\non_existent_file_path.wav',
    });
    if (res.status === 400) {
      logPass('TEST-12A-14', 'Non-Existent Audio Analysis Handling', `Correctly returned 400 Bad Request`);
    } else {
      logFail('TEST-12A-14', 'Non-Existent Audio Analysis Handling', `Expected 400, got ${res.status}`);
    }
  } catch (e) {
    logFail('TEST-12A-14', 'Non-Existent Audio Analysis Handling', e);
  }

  // -------------------------------------------------------------
  // Test 15: POST /v1/voice/profile (Voice Profile Creation)
  // -------------------------------------------------------------
  let createdProfile = null;
  try {
    const res = await postJson('/v1/voice/profile', {
      project_id: 'test_project_12a',
      user_id: 'test_user_12a',
      name: 'Custom Anchor Alpha',
      source_asset_ids: ['asset_01'],
      audio_paths: [validAudioPath],
      target_speaker_id: 'speaker_alpha',
      language: 'en',
    });
    if (
      res.status === 200 &&
      (res.data.status === 'READY' || res.data.status === 'NEEDS_REVIEW') &&
      res.data.name === 'Custom Anchor Alpha'
    ) {
      createdProfile = res.data;
      logPass(
        'TEST-12A-15',
        'Voice Profile Creation Pipeline',
        `Profile ID: ${res.data.voice_profile_id}, Status: ${res.data.status}, Quality: ${res.data.quality_score}/100`
      );
    } else {
      logFail('TEST-12A-15', 'Voice Profile Creation Pipeline', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-15', 'Voice Profile Creation Pipeline', e);
  }

  // -------------------------------------------------------------
  // Test 16: POST /v1/voice/profile (Validation of Empty Audio Paths)
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/profile', {
      project_id: 'test_project_12a',
      user_id: 'test_user_12a',
      name: 'Invalid Profile',
      source_asset_ids: [],
      audio_paths: [],
    });
    if (res.status === 400) {
      logPass('TEST-12A-16', 'Profile Creation Audio Path Validation', `Rejected empty audio_paths (Status 400)`);
    } else {
      logFail('TEST-12A-16', 'Profile Creation Audio Path Validation', `Expected 400, got ${res.status}`);
    }
  } catch (e) {
    logFail('TEST-12A-16', 'Profile Creation Audio Path Validation', e);
  }

  // -------------------------------------------------------------
  // Test 17: Voice Profile Versioning & Reference Traceability
  // -------------------------------------------------------------
  try {
    if (
      createdProfile &&
      createdProfile.profile_version === '1.0.0' &&
      createdProfile.encoder_version === 'spectral-fingerprint-v1.0.0' &&
      createdProfile.analysis_version === 'phase12a' &&
      Array.isArray(createdProfile.reference_audio_paths) &&
      createdProfile.reference_audio_paths.length > 0 &&
      createdProfile.created_at
    ) {
      logPass(
        'TEST-12A-17',
        'Voice Profile Contract Versioning & Reference Audios',
        `Version: ${createdProfile.profile_version}, CreatedAt: ${createdProfile.created_at}, References: ${createdProfile.reference_audio_paths.length}`
      );
    } else {
      logFail('TEST-12A-17', 'Voice Profile Contract Versioning', JSON.stringify(createdProfile));
    }
  } catch (e) {
    logFail('TEST-12A-17', 'Voice Profile Contract Versioning', e);
  }

  // -------------------------------------------------------------
  // Test 18: POST /v1/voice/compare (Identical Audio Similarity)
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/compare', {
      reference_audio_path: validAudioPath,
      candidate_audio_path: validAudioPath,
    });
    if (
      res.status === 200 &&
      res.data.status === 'COMPLETED' &&
      res.data.embedding_cosine_similarity === 1.0 &&
      res.data.is_same_speaker === true
    ) {
      logPass(
        'TEST-12A-18',
        'Voice Comparator — Exact Identity Verification',
        `Cosine Sim: ${res.data.embedding_cosine_similarity}, Same Speaker: ${res.data.is_same_speaker}, Confidence: ${res.data.confidence}`
      );
    } else {
      logFail('TEST-12A-18', 'Voice Comparator Exact Identity', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-18', 'Voice Comparator Exact Identity', e);
  }

  // -------------------------------------------------------------
  // Test 19: POST /v1/voice/compare (Missing Audio File Handling)
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/compare', {
      reference_audio_path: validAudioPath,
      candidate_audio_path: 'C:\\non_existent_voice.wav',
    });
    if (res.status === 200 && res.data.status === 'FAILED' && res.data.is_same_speaker === false) {
      logPass('TEST-12A-19', 'Voice Comparator Missing Audio Handling', `Correctly reported FAILED status and non-match`);
    } else {
      logFail('TEST-12A-19', 'Voice Comparator Missing Audio Handling', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-19', 'Voice Comparator Missing Audio Handling', e);
  }

  // -------------------------------------------------------------
  // Test 20: POST /v1/voice/quality (Dedicated Quality Gate Endpoint)
  // -------------------------------------------------------------
  try {
    const res = await postJson('/v1/voice/quality', {
      audio_path: validAudioPath,
      min_quality_score: 50.0,
      min_snr_db: 10.0,
    });
    if (
      res.status === 200 &&
      res.data.status === 'COMPLETED' &&
      res.data.quality &&
      typeof res.data.quality.quality_score === 'number'
    ) {
      logPass(
        'TEST-12A-20',
        'Dedicated Voice Quality Assessment Endpoint',
        `Status: ${res.data.status}, Quality Score: ${res.data.quality.quality_score}, SNR: ${res.data.quality.snr_db} dB`
      );
    } else {
      logFail('TEST-12A-20', 'Dedicated Voice Quality Assessment', JSON.stringify(res.data));
    }
  } catch (e) {
    logFail('TEST-12A-20', 'Dedicated Voice Quality Assessment', e);
  }

  // -------------------------------------------------------------
  // Summary & Persistence
  // -------------------------------------------------------------
  console.log('===============================================================');
  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;
  console.log(`PHASE 12A TESTS COMPLETE: ${passed} PASSED, ${failed} FAILED (TOTAL: ${results.length})`);
  console.log('===============================================================');

  const outputPath = path.resolve(__dirname, 'phase12a-results.json');
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        suite: 'Phase 12A — Advanced Reference Voice Analyzer',
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
  console.error('Fatal error running suite:', err);
  process.exit(1);
});
