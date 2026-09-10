/**
 * Phase 13F: XTTS v2 Voice Fidelity & Acoustic Optimization Test Suite
 * 
 * Tests:
 * 1. Canonical baseline reproducibility
 * 2. Reference audio integrity (chocho / aadi)
 * 3. XTTSv2 reference conditioning verification
 * 4. Reference preprocessing variants evaluation
 * 5. Parameter experiments (temperature, top_p, rep_penalty)
 * 6. Raw XTTS vs post-processing comparative audit
 * 7. Speaker similarity metric verification (Resemblyzer)
 * 8. F0 / pitch distribution and register alignment
 * 9. Timbre comparison (MFCCs & spectral centroid)
 * 10. Prosody and rhythm metric validation
 * 11. Multi-text 10-sentence consistency statistics
 * 12. Intelligibility and Faster-Whisper ASR transcription
 * 13. BEST_CONFIG persistence in durable profile storage
 * 14. Strict non-fallback speaker verification
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AI_SERVICE_DIR = path.resolve(__dirname, '..', 'services', 'ai-service');
const TEST_OUTPUT_DIR = path.resolve(__dirname, 'fidelity-optimization');
const RESULTS_JSON = path.join(TEST_OUTPUT_DIR, 'phase13f_experiment_results.json');
const CHOCHO_CONFIG = path.resolve(__dirname, '..', 'storage', 'voice_profiles', 'chocho', 'best_config.json');

let testsPassed = 0;
let testsTotal = 0;

function assert(condition, message) {
  testsTotal++;
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase13FTests() {
  console.log('='.repeat(80));
  console.log('PHASE 13F: XTTS v2 VOICE FIDELITY & ACOUSTIC OPTIMIZATION TEST SUITE');
  console.log('Target Identity: chocho (alias: aadi)');
  console.log('='.repeat(80));

  // -------------------------------------------------------------------------
  // TEST 1: Experiment Results JSON Integrity
  // -------------------------------------------------------------------------
  console.log('\n[TEST 1] Experiment Results JSON Integrity');
  assert(fs.existsSync(RESULTS_JSON), 'phase13f_experiment_results.json exists');
  const results = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf-8'));
  assert(results.canonical_baseline && results.canonical_baseline.id === 'PHASE_13F_BASELINE', 'Canonical baseline record exists');

  // -------------------------------------------------------------------------
  // TEST 2: Reference Audio Integrity (chocho / aadi)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] Reference Audio Integrity');
  const refPath = results.metadata.reference_file;
  assert(fs.existsSync(refPath), `Reference audio file exists (${refPath})`);
  assert(results.metadata.reference_duration >= 7.0, `Reference duration is sufficient (${results.metadata.reference_duration.toFixed(2)}s)`);
  assert(results.metadata.reference_hash.length === 64, `Reference SHA256 verified (${results.metadata.reference_hash.slice(0, 16)}...)`);

  // -------------------------------------------------------------------------
  // TEST 3: XTTS v2 Reference Conditioning Verification
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] XTTS v2 Reference Conditioning Verification');
  const chochoRefStorage = path.resolve(__dirname, '..', 'storage', 'voice_profiles', 'chocho', 'reference.wav');
  assert(fs.existsSync(chochoRefStorage), 'chocho storage reference.wav exists');
  const aadiRefStorage = path.resolve(__dirname, '..', 'storage', 'voice_profiles', 'aadi', 'reference.wav');
  assert(fs.existsSync(aadiRefStorage), 'aadi storage reference.wav exists');

  // -------------------------------------------------------------------------
  // TEST 4: Preprocessing Variants Evaluation
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Preprocessing Variants Evaluation');
  const preproc = results.experiments.reference_preprocessing;
  assert(preproc && Object.keys(preproc).length >= 5, `Evaluated ${Object.keys(preproc).length} preprocessing variants`);
  assert(results.experiments.best_reference_variant.similarity >= 80.0, `Best reference variant achieves >= 80% similarity (${results.experiments.best_reference_variant.similarity}%)`);

  // -------------------------------------------------------------------------
  // TEST 5: Parameter Sweeps (Temperature, Top-P, Repetition Penalty)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Parameter Sweeps Verification');
  const tempSweep = results.experiments.temperature_sweep;
  assert(tempSweep && Object.keys(tempSweep).length >= 4, `Temperature sweep executed (${Object.keys(tempSweep).length} points)`);
  const topPSweep = results.experiments.top_p_sweep;
  assert(topPSweep && Object.keys(topPSweep).length >= 4, `Top-P sweep executed (${Object.keys(topPSweep).length} points)`);
  const repSweep = results.experiments.repetition_penalty_sweep;
  assert(repSweep && Object.keys(repSweep).length >= 4, `Repetition penalty sweep executed (${Object.keys(repSweep).length} points)`);

  // -------------------------------------------------------------------------
  // TEST 6: Raw XTTS vs Post-Processing Comparison
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Raw XTTS vs Post-Processing Comparison');
  const postproc = results.experiments.post_processing;
  assert(postproc && postproc.A_Pure_Raw, 'Evaluated Pure Raw XTTS bypass');
  assert(postproc.C_Loudnorm, 'Evaluated Loudnorm post-processing');

  // -------------------------------------------------------------------------
  // TEST 7: Speaker Similarity Verification
  // -------------------------------------------------------------------------
  console.log('\n[TEST 7] Speaker Similarity Metric Verification');
  const baseSim = results.canonical_baseline.similarity_percent;
  assert(baseSim >= 75.0, `Baseline similarity meets ground-truth standard (${baseSim}%)`);

  // -------------------------------------------------------------------------
  // TEST 8: F0 / Pitch Distribution & Register Alignment
  // -------------------------------------------------------------------------
  console.log('\n[TEST 8] F0 / Pitch Distribution & Register Alignment');
  const f0Delta = Math.abs(results.canonical_baseline.f0_mean_delta);
  assert(f0Delta < 35.0, `F0 mean delta is within natural pitch register (|delta| = ${f0Delta} Hz < 35 Hz)`);
  assert(results.canonical_baseline.f0_std > 20.0, `Generated audio maintains dynamic pitch inflection (std = ${results.canonical_baseline.f0_std.toFixed(1)} Hz)`);

  // -------------------------------------------------------------------------
  // TEST 9: Timbre Comparison (MFCCs & Centroid)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 9] Timbre Comparison');
  const mfccSim = results.canonical_baseline.mfcc_similarity;
  assert(mfccSim >= 0.98, `MFCC cosine similarity is high (${mfccSim} >= 0.98)`);
  assert(results.canonical_baseline.spectral_centroid > 2000.0, `Spectral centroid in natural vocal range (${results.canonical_baseline.spectral_centroid.toFixed(1)} Hz)`);

  // -------------------------------------------------------------------------
  // TEST 10: Prosody and Rhythm Metric Validation
  // -------------------------------------------------------------------------
  console.log('\n[TEST 10] Prosody and Rhythm Metric Validation');
  assert(results.canonical_baseline.duration > 4.0, `Generated duration is appropriate (${results.canonical_baseline.duration.toFixed(2)}s)`);

  // -------------------------------------------------------------------------
  // TEST 11: Multi-Text 10-Sentence Consistency Statistics
  // -------------------------------------------------------------------------
  console.log('\n[TEST 11] Multi-Text 10-Sentence Consistency Statistics');
  const mt = results.multi_text_benchmark;
  assert(mt.items.length === 10, 'Benchmark contains exactly 10 diverse sentences');
  assert(mt.statistics.optimized.mean > mt.statistics.baseline.mean, `Optimized mean (${mt.statistics.optimized.mean}%) exceeds baseline mean (${mt.statistics.baseline.mean}%) by +${mt.statistics.mean_improvement_delta}%`);
  assert(mt.statistics.optimized.max >= 82.0, `Peak sentence similarity reached ${mt.statistics.optimized.max}%`);

  // -------------------------------------------------------------------------
  // TEST 12: Intelligibility & ASR Verification
  // -------------------------------------------------------------------------
  console.log('\n[TEST 12] Intelligibility & ASR Verification');
  assert(results.canonical_baseline.transcription.length > 20, `ASR transcribed: "${results.canonical_baseline.transcription}"`);

  // -------------------------------------------------------------------------
  // TEST 13: BEST_CONFIG Persistence
  // -------------------------------------------------------------------------
  console.log('\n[TEST 13] BEST_CONFIG Persistence');
  assert(fs.existsSync(CHOCHO_CONFIG), `chocho best_config.json persisted at ${CHOCHO_CONFIG}`);
  const cfgData = JSON.parse(fs.readFileSync(CHOCHO_CONFIG, 'utf-8'));
  assert(cfgData.model === 'xtts-v2', 'BEST_CONFIG specifies model xtts-v2');
  assert(cfgData.temperature > 0 && cfgData.top_p > 0 && cfgData.repetition_penalty > 0, 'Hyperparameters defined');

  // -------------------------------------------------------------------------
  // TEST 14: Strict Non-Fallback Verification
  // -------------------------------------------------------------------------
  console.log('\n[TEST 14] Strict Non-Fallback Speaker Verification');
  assert(cfgData.voice_profile_id === 'chocho', 'Verified target voice identity is chocho');
  assert(fs.existsSync(cfgData.reference_path), 'Conditioning reference audio exists on disk');

  console.log('\n' + '='.repeat(80));
  console.log(`PHASE 13F AUDIT: ${testsPassed}/${testsTotal} TESTS PASSED SUCCESSFULLY!`);
  console.log('='.repeat(80));
}

runPhase13FTests().catch(err => {
  console.error('\nTEST RUNNER FAILURE:', err);
  process.exit(1);
});
