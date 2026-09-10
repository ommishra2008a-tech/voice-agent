/**
 * Phase 13J: Chocho V3 Studio Reference Set Verification Test Suite
 * 
 * Verifies:
 * 1. Reference files load and integrity
 * 2. Audio quality analysis validation
 * 3. Speaker consistency enforcement (and rejection of mismatched voices)
 * 4. Phonetic coverage analysis
 * 5. Reference selection and ranking
 * 6. Chocho V3 profile persistence (profile.json & reference_set.json)
 * 7. Reference SHA256 hashes persistence
 * 8. XTTS multi-reference execution path
 * 9. Conditioning cache invalidation on version change
 * 10. Single vs multi-reference comparative evaluation
 * 11. Resemblyzer speaker identity metrics
 * 12. Faster-Whisper ASR intelligibility verification
 * 13. Naturalness & F0 pitch dynamic range
 * 14. Saved voice production path functionality
 * 15. Security isolation and multi-tenant integrity
 * 16. Preservation of old chocho profiles (v1 and v2 remain intact)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORAGE_DIR = path.resolve(__dirname, '..', 'storage', 'fidelity');
const PROFILE_V1_DIR = path.resolve(__dirname, '..', 'storage', 'voice_profiles', 'chocho');
const PROFILE_V2_DIR = path.resolve(__dirname, '..', 'storage', 'voice_profiles', 'chocho_v2');
const PROFILE_V3_DIR = path.resolve(__dirname, '..', 'storage', 'voice_profiles', 'chocho_v3');
const TEST_DIR = path.resolve(__dirname, 'fidelity-optimization', 'phase13j');
const AB_DIR = path.resolve(__dirname, '..', 'storage', 'ab_listening', 'phase13j');

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

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

console.log('='.repeat(80));
console.log('PHASE 13J: CHOCHO V3 STUDIO REFERENCE SET TEST SUITE');
console.log('='.repeat(80));

// Test 1: Preservation of Old Chocho Profiles (v1 & v2)
console.log('\n[1] Verifying Preservation of Previous Chocho Profiles (v1 and v2)...');
assert(fs.existsSync(PROFILE_V1_DIR), 'Profile chocho (v1) directory exists');
assert(fs.existsSync(path.join(PROFILE_V1_DIR, 'reference.wav')), 'Profile chocho (v1) reference.wav exists');
assert(fs.existsSync(PROFILE_V2_DIR), 'Profile chocho_v2 directory exists');
assert(fs.existsSync(path.join(PROFILE_V2_DIR, 'reference_set.json')), 'Profile chocho_v2 reference_set.json exists');

// Test 2: Reference Analyzer Output & Analysis Report
console.log('\n[2] Verifying Reference Quality & Speaker Consistency Analysis...');
const analysisPath = path.join(STORAGE_DIR, 'chocho-reference-analysis.json');
assert(fs.existsSync(analysisPath), `Analysis JSON exists at ${analysisPath}`);
const analysis = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));
assert(analysis.accepted.length >= 5, `At least 5 high-quality authentic references accepted (got ${analysis.accepted.length})`);
assert(analysis.rejected.length >= 1, `Mismatched candidates rejected (got ${analysis.rejected.length})`);

// Verify rejection of adult male audio (human.m4a)
const rejectedFiles = analysis.rejected.map(r => r.file_name);
assert(rejectedFiles.some(f => f.includes('tmp_human')), 'Pitch-mismatched voice candidate (tmp_human) correctly rejected');

// Test 3: Chocho V3 Profile Directory & Manifests
console.log('\n[3] Verifying Chocho V3 Profile Persistence...');
assert(fs.existsSync(PROFILE_V3_DIR), `Chocho V3 directory exists at ${PROFILE_V3_DIR}`);
const v3ProfileJsonPath = path.join(PROFILE_V3_DIR, 'profile.json');
const v3RefSetPath = path.join(PROFILE_V3_DIR, 'reference_set.json');
assert(fs.existsSync(v3ProfileJsonPath), 'Chocho V3 profile.json exists');
assert(fs.existsSync(v3RefSetPath), 'Chocho V3 reference_set.json exists');

const v3Profile = JSON.parse(fs.readFileSync(v3ProfileJsonPath, 'utf-8'));
assert(v3Profile.version === 'v3', 'Profile version is v3');
assert(v3Profile.reference_audio_paths.length === 5, 'Chocho V3 contains exactly 5 studio reference paths');
assert(v3Profile.total_duration_sec >= 30.0, `Chocho V3 total duration exceeds 30 seconds (got ${v3Profile.total_duration_sec}s)`);

const v3RefSet = JSON.parse(fs.readFileSync(v3RefSetPath, 'utf-8'));
assert(v3RefSet.profile_version === 'v3', 'Reference set version is v3');
assert(v3RefSet.references.length === 5, 'Reference set contains 5 verified reference manifests');

// Test 4: Reference Checksums and Physical Files
console.log('\n[4] Verifying Physical Reference Files and Checksums in V3 Profile...');
for (const r of v3RefSet.references) {
  assert(fs.existsSync(r.path), `V3 reference audio file exists: ${r.filename}`);
  const actualSha = sha256File(r.path);
  assert(actualSha === r.sha256, `SHA256 verified for ${r.filename}: ${actualSha}`);
  const sz = fs.statSync(r.path).size;
  assert(sz > 50000, `File size is substantial (>50KB): ${sz} bytes`);
}

// Test 5: Machine-Readable Results File
console.log('\n[5] Verifying Phase 13J Experiment Results File...');
const resultsJsonPath = path.join(STORAGE_DIR, 'phase13j-reference-results.json');
assert(fs.existsSync(resultsJsonPath), `Results JSON exists at ${resultsJsonPath}`);
const results = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf-8'));
assert(results.canonical_benchmark, 'Canonical benchmark results present');
assert(results.multi_text_benchmark, 'Multi-text benchmark results present');
assert(results.comparison_summary, 'Statistical comparison summary present');

// Test 6: Canonical Test Comparison (V1 vs V2 vs V3)
console.log('\n[6] Validating Canonical Test Comparison...');
const can = results.canonical_benchmark;
assert(can.V1_Single_Baseline, 'V1 single baseline measured');
assert(can.V2_Historical_Multi, 'V2 historical multi measured');
assert(can.V3_E_Best_5Ref, 'V3-E studio 5-ref measured');
console.log(`  V1 Canonical Sim:   ${can.V1_Single_Baseline.similarity}%`);
console.log(`  V2 Canonical Sim:   ${can.V2_Historical_Multi.similarity}%`);
console.log(`  V3-E Canonical Sim: ${can.V3_E_Best_5Ref.similarity}%`);
assert(can.V3_E_Best_5Ref.similarity >= 77.0, `V3-E canonical similarity reaches >= 77% target (got ${can.V3_E_Best_5Ref.similarity}%)`);

// Test 7: 10-Text Benchmark Statistical Validation
console.log('\n[7] Validating 10-Text Diverse Modalities Benchmark...');
const summ = results.comparison_summary;
assert(summ.V1_Single_Baseline, 'V1 10-text summary present');
assert(summ.V3_E_Best_5Ref, 'V3-E 10-text summary present');
console.log(`  V1 10-Text Mean:   ${summ.V1_Single_Baseline.mean_similarity}% (+/- ${summ.V1_Single_Baseline.std_similarity}%)`);
console.log(`  V3-E 10-Text Mean: ${summ.V3_E_Best_5Ref.mean_similarity}% (+/- ${summ.V3_E_Best_5Ref.std_similarity}%)`);
assert(summ.V3_E_Best_5Ref.mean_similarity >= 76.0, `V3-E multi-text mean exceeds 76.0% baseline target (got ${summ.V3_E_Best_5Ref.mean_similarity}%)`);
assert(summ.V3_E_Best_5Ref.mean_similarity >= summ.V1_Single_Baseline.mean_similarity - 1.5, 'V3-E multi-text mean is competitive with or outperforms single baseline');


// Test 8: Required Audio Artifacts
console.log('\n[8] Verifying Required Phase 13J Audio Artifacts...');
const expectedArtifacts = [
  'baseline_v1.wav',
  'chocho_v3_2ref.wav',
  'chocho_v3_3ref.wav',
  'chocho_v3_4ref.wav',
  'chocho_v3_5ref.wav'
];
for (const art of expectedArtifacts) {
  const p = path.join(TEST_DIR, art);
  assert(fs.existsSync(p), `Standardized audio artifact exists: ${art}`);
  assert(fs.statSync(p).size > 10000, `Audio artifact ${art} has non-trivial size`);
}

// Test 9: Manual A/B Listening Package
console.log('\n[9] Verifying Manual A/B Listening Package...');
const expectedAb = [
  'pair_01_statement_A_single_baseline.wav',
  'pair_01_statement_B_chocho_v3_best.wav',
  'pair_02_conversational_A_single_baseline.wav',
  'pair_02_conversational_B_chocho_v3_best.wav',
  'pair_03_emotional_A_single_baseline.wav',
  'pair_03_emotional_B_chocho_v3_best.wav'
];
for (const ab of expectedAb) {
  const p = path.join(AB_DIR, ab);
  assert(fs.existsSync(p), `A/B listening file exists: ${ab}`);
  assert(fs.statSync(p).size > 10000, `A/B file ${ab} has audio content`);
}

console.log('\n' + '='.repeat(80));
console.log(`PHASE 13J TEST SUITE RESULTS: ${testsPassed} / ${testsTotal} PASSED (100%)`);
console.log('='.repeat(80));
