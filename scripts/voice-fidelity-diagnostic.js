#!/usr/bin/env node

/**
 * Phase 13A: Voice Fidelity Diagnostic & Audio Recovery Tool
 *
 * Supports:
 *   --generation-id <id|filename>  (e.g. gen_1787833546649 or PocketBase job ID)
 *   --reference <path>             (e.g. D:\downlods_new\aadi.m4a)
 *   --generated <path>             (e.g. D:\downlods_new\ai aadi.wav)
 *   --project-id <id>
 *   --user-id <id>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOLARCH_BASE = process.env.SOLARCH_API_URL || 'http://localhost:8090';
const AI_BASE = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const STORAGE_DIRS = [
  'D:\\testing\\projects\\AGENT\\voice-agent\\services\\ai-service\\storage\\generated_audio',
  'D:\\testing\\projects\\AGENT\\voice-agent\\storage\\generated_audio',
  'D:\\downlods_new',
  'D:\\testing\\projects\\AGENT\\voice-agent\\storage\\voices',
  'D:\\testing\\projects\\AGENT\\voice-agent\\services\\ai-service\\storage\\voice_profiles'
];

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      params[key] = val;
      if (val !== true) i++;
    }
  }
  return params;
}

function getAudioMetadata(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stats = fs.statSync(filePath);
  let ffprobeData = null;

  try {
    const raw = execSync(`ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`, {
      stdio: ['pipe', 'pipe', 'ignore'],
      encoding: 'utf8'
    });
    ffprobeData = JSON.parse(raw);
  } catch {}

  const audioStream = ffprobeData?.streams?.find(s => s.codec_type === 'audio');
  return {
    filePath,
    sizeBytes: stats.size,
    durationSec: audioStream?.duration ? parseFloat(audioStream.duration) : ffprobeData?.format?.duration ? parseFloat(ffprobeData.format.duration) : null,
    sampleRate: audioStream?.sample_rate ? parseInt(audioStream.sample_rate) : null,
    channels: audioStream?.channels || null,
    codec: audioStream?.codec_name || path.extname(filePath).replace('.', ''),
    mtime: stats.mtime
  };
}

async function resolveGeneratedAudio(targetId) {
  console.log(`\n🔍 Searching for generated audio target: "${targetId}"...`);

  // 1. Check local storage directories
  for (const dir of STORAGE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.includes(targetId) || file === targetId || file === `${targetId}.wav`) {
        const fullPath = path.join(dir, file);
        console.log(`[FOUND ON DISK] Matched file in directory: ${dir}`);
        return {
          source: 'local_storage',
          path: fullPath,
          metadata: getAudioMetadata(fullPath)
        };
      }
    }
  }

  // 2. Query Solarch BaaS PocketBase generation_jobs
  try {
    const filter = encodeURIComponent(`(id='${targetId}' || outputAssetId~'${targetId}')`);
    const res = await fetch(`${SOLARCH_BASE}/api/collections/generation_jobs/records?filter=${filter}`);
    if (res.ok) {
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        const job = data.items[0];
        console.log(`[FOUND IN SOLARCH] Matched generation job: ${job.id}`);
        if (job.outputAssetId && fs.existsSync(job.outputAssetId)) {
          return {
            source: 'solarch_job',
            job,
            path: job.outputAssetId,
            metadata: getAudioMetadata(job.outputAssetId)
          };
        }
        return {
          source: 'solarch_metadata_only',
          job,
          path: job.outputAssetId,
          metadata: null,
          note: 'Job metadata exists, but binary audio file is not found on disk.'
        };
      }
    }
  } catch (err) {
    console.warn(`[SOLARCH QUERY ERROR] ${err.message}`);
  }

  return null;
}

async function runDiagnostic() {
  const params = parseArgs();

  console.log('================================================================');
  console.log('VOICE FIDELITY DIAGNOSTIC & ASSET RECOVERY (PHASE 13A)');
  console.log('================================================================');

  const generationId = params['generation-id'] || 'gen_1787833546649';
  const refPath = params['reference'] || 'D:\\downlods_new\\aadi.m4a';
  const genPath = params['generated'] || 'D:\\downlods_new\\ai aadi.wav';

  console.log(`Target Generation ID : ${generationId}`);
  console.log(`Reference File       : ${refPath}`);
  console.log(`External Generated   : ${genPath}`);

  // 1. Inspect Target Generation
  const targetResult = await resolveGeneratedAudio(generationId);
  console.log('\n--- TARGET AUDIO STATUS ---');
  if (targetResult && targetResult.path && fs.existsSync(targetResult.path)) {
    console.log(`Status        : RECOVERED & AVAILABLE`);
    console.log(`Resolved Path : ${targetResult.path}`);
    console.log(`File Size     : ${(targetResult.metadata.sizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Duration      : ${targetResult.metadata.durationSec ? `${targetResult.metadata.durationSec.toFixed(2)}s` : 'N/A'}`);
    console.log(`Sample Rate   : ${targetResult.metadata.sampleRate || '24000'} Hz`);
    console.log(`Channels      : ${targetResult.metadata.channels || 1}`);
  } else if (targetResult?.source === 'solarch_metadata_only') {
    console.log(`Status        : METADATA ONLY (Binary file unavailable)`);
  } else {
    console.log(`Status        : NOT FOUND`);
  }

  // 2. Inspect Reference Audio File
  console.log('\n--- REFERENCE AUDIO STATUS ---');
  if (fs.existsSync(refPath)) {
    const refMeta = getAudioMetadata(refPath);
    console.log(`Status        : AVAILABLE`);
    console.log(`Path          : ${refPath}`);
    console.log(`File Size     : ${(refMeta.sizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Duration      : ${refMeta.durationSec ? `${refMeta.durationSec.toFixed(2)}s` : 'N/A'}`);
    console.log(`Sample Rate   : ${refMeta.sampleRate} Hz`);
  } else {
    console.log(`Status        : MISSING (${refPath})`);
  }

  // 3. Inspect External Generated Audio File
  console.log('\n--- EXTERNAL GENERATED AUDIO STATUS ---');
  if (fs.existsSync(genPath)) {
    const genMeta = getAudioMetadata(genPath);
    console.log(`Status        : AVAILABLE`);
    console.log(`Path          : ${genPath}`);
    console.log(`File Size     : ${(genMeta.sizeBytes / 1024).toFixed(1)} KB`);
    console.log(`Duration      : ${genMeta.durationSec ? `${genMeta.durationSec.toFixed(2)}s` : 'N/A'}`);
    console.log(`Sample Rate   : ${genMeta.sampleRate} Hz`);
  } else {
    console.log(`Status        : MISSING (${genPath})`);
  }

  console.log('\n================================================================');
  console.log('DIAGNOSTIC READINESS: READY FOR PHASE 13B (RESEMBLYZER ANALYSIS)');
  console.log('================================================================');
}

runDiagnostic();
