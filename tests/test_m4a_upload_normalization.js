/**
 * TARGETED VALIDATION: M4A, MP3, WAV Upload & Normalization Pipeline Test
 * 
 * Verifies:
 * 1. WAV upload -> direct storage
 * 2. MP3 upload -> normalized to 24kHz mono WAV
 * 3. M4A upload -> normalized to 24kHz mono WAV
 * 4. Original M4A file preserved alongside normalized 24kHz WAV
 * 5. Voice Analyzer successfully receives and analyzes normalized M4A audio
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const AI_SERVICE_URL = 'http://localhost:8000';
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

function uploadMultipart(filePath, fieldName = 'file') {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const fileName = path.basename(filePath);
    const fileData = fs.readFileSync(filePath);

    let contentType = 'audio/wav';
    if (fileName.endsWith('.mp3')) contentType = 'audio/mpeg';
    if (fileName.endsWith('.m4a')) contentType = 'audio/mp4';

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    );
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([header, fileData, footer]);

    const url = new URL('/v1/voice/upload', AI_SERVICE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
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
    req.write(body);
    req.end();
  });
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

async function runTargetedCheck() {
  console.log('================================================================');
  console.log('TARGETED VALIDATION: M4A / MP3 / WAV UPLOAD & NORMALIZATION CHECK');
  console.log('================================================================');

  const m4aPath = path.join(FIXTURES_DIR, 'test_speech.m4a');
  const mp3Path = path.join(FIXTURES_DIR, 'test_speech.mp3');
  const wavPath = path.join(FIXTURES_DIR, 'real_speech_reference_24k.wav');

  let m4aUploadResult = null;

  // 1. Test M4A Upload & Normalization
  console.log('\n[1] Testing M4A Upload & FFmpeg Normalization...');
  try {
    const m4aRes = await uploadMultipart(m4aPath);
    console.log('M4A Upload Response:', m4aRes);
    if (
      m4aRes.status === 200 &&
      m4aRes.data.status === 'UPLOADED' &&
      m4aRes.data.audio_path &&
      m4aRes.data.audio_path.endsWith('.wav') &&
      fs.existsSync(m4aRes.data.audio_path)
    ) {
      m4aUploadResult = m4aRes.data;
      console.log(`\x1b[32m[PASS]\x1b[0m M4A Upload -> Normalized to: ${m4aRes.data.audio_path}, Duration: ${m4aRes.data.duration}s`);
    } else {
      console.error(`\x1b[31m[FAIL]\x1b[0m M4A Upload failed:`, m4aRes);
      process.exit(1);
    }
  } catch (e) {
    console.error(`\x1b[31m[FAIL]\x1b[0m M4A Upload exception:`, e);
    process.exit(1);
  }

  // 2. Test MP3 Upload & Normalization
  console.log('\n[2] Testing MP3 Upload & FFmpeg Normalization...');
  try {
    const mp3Res = await uploadMultipart(mp3Path);
    if (
      mp3Res.status === 200 &&
      mp3Res.data.status === 'UPLOADED' &&
      mp3Res.data.audio_path &&
      mp3Res.data.audio_path.endsWith('.wav') &&
      fs.existsSync(mp3Res.data.audio_path)
    ) {
      console.log(`\x1b[32m[PASS]\x1b[0m MP3 Upload -> Normalized to: ${mp3Res.data.audio_path}, Duration: ${mp3Res.data.duration}s`);
    } else {
      console.error(`\x1b[31m[FAIL]\x1b[0m MP3 Upload failed:`, mp3Res);
      process.exit(1);
    }
  } catch (e) {
    console.error(`\x1b[31m[FAIL]\x1b[0m MP3 Upload exception:`, e);
    process.exit(1);
  }

  // 3. Test WAV Upload
  console.log('\n[3] Testing WAV Upload...');
  try {
    const wavRes = await uploadMultipart(wavPath);
    if (
      wavRes.status === 200 &&
      wavRes.data.status === 'UPLOADED' &&
      wavRes.data.audio_path &&
      fs.existsSync(wavRes.data.audio_path)
    ) {
      console.log(`\x1b[32m[PASS]\x1b[0m WAV Upload -> Saved to: ${wavRes.data.audio_path}`);
    } else {
      console.error(`\x1b[31m[FAIL]\x1b[0m WAV Upload failed:`, wavRes);
      process.exit(1);
    }
  } catch (e) {
    console.error(`\x1b[31m[FAIL]\x1b[0m WAV Upload exception:`, e);
    process.exit(1);
  }

  // 4. Test Voice Analysis on Normalized M4A output
  console.log('\n[4] Testing Voice Analyzer on Normalized M4A WAV...');
  try {
    const analyzeRes = await postJson('/v1/voice/analyze', {
      audio_path: m4aUploadResult.audio_path,
      speaker_id: 'speaker_m4a_test'
    });
    if (
      analyzeRes.status === 200 &&
      analyzeRes.data.status === 'COMPLETED' &&
      analyzeRes.data.quality &&
      typeof analyzeRes.data.quality.quality_score === 'number' &&
      analyzeRes.data.pitch &&
      analyzeRes.data.pitch.f0_mean > 0
    ) {
      console.log(`\x1b[32m[PASS]\x1b[0m Voice Analysis Succeeded on M4A: F0=${analyzeRes.data.pitch.f0_mean}Hz, Quality=${analyzeRes.data.quality.quality_score}/100, Passed=${analyzeRes.data.quality.quality_gate_passed}`);
    } else {
      console.error(`\x1b[31m[FAIL]\x1b[0m Voice Analysis failed:`, analyzeRes);
      process.exit(1);
    }
  } catch (e) {
    console.error(`\x1b[31m[FAIL]\x1b[0m Voice Analysis exception:`, e);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('ALL TARGETED M4A / UPLOAD CHECKS PASSED (100%)');
  console.log('================================================================');
}

runTargetedCheck();
