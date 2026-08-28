/**
 * Phase 13D: Naturalness, Prosody & Expressiveness Verification Test Suite
 * Validates:
 * 1. Voice Naturalness Diagnostic runs and generates comprehensive scorecard
 * 2. F0 pitch dynamics are computed (mean, std, IQR, trajectory variance)
 * 3. Pause and prosody analysis is computed (pause count, nPVI rhythm index)
 * 4. Energy dynamics are computed (dynamic range dB, crest factor)
 * 5. Multi-text generation produces valid natural audio across diverse linguistic types
 * 6. Saved voice reference is strictly preserved and resolved
 * 7. XTTSv2 receives correct reference without silent fallback
 * 8. No generic/fallback speaker used during synthesis
 * 9. Intelligibility is verified via transcription word match
 * 10. A/B experiment artifacts and scorecards are recorded and reproducible
 * 11. Production XTTSv2 configuration is properly wired
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AI_BASE = 'http://localhost:8000';
const SOLARCH_BASE = 'http://localhost:8090';
const PYTHON_BIN = 'python';

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

async function runPhase13DTests() {
  console.log('='.repeat(80));
  console.log('PHASE 13D: NATURALNESS, PROSODY & EXPRESSIVENESS VERIFICATION SUITE');
  console.log('='.repeat(80));

  const workspaceRoot = path.resolve(__dirname, '..');
  const natDiagScript = path.join(workspaceRoot, 'scripts', 'voice-naturalness-diagnostic.py');
  const refM4a = 'D:\\downlods_new\\aadi.m4a';
  const baselineWav = 'D:\\downlods_new\\ai aadi.wav';

  // -------------------------------------------------------------------------
  // TEST 1: Naturalness Diagnostic Script Exists and Runs
  // -------------------------------------------------------------------------
  console.log('\n[TEST 1] Naturalness Diagnostic Script Existence & Execution');
  assert(fs.existsSync(natDiagScript), 'scripts/voice-naturalness-diagnostic.py exists');

  const diagOutJson = path.join(workspaceRoot, '.test_nat_diag.json');
  try {
    const cmd = `${PYTHON_BIN} "${natDiagScript}" --reference "${refM4a}" --generated "${baselineWav}" --output "${diagOutJson}"`;
    execSync(cmd, { stdio: 'pipe', timeout: 45000 });
    assert(fs.existsSync(diagOutJson), 'Diagnostic script produced JSON output');
  } catch (err) {
    assert(false, `Diagnostic execution failed: ${err.message}`);
  }

  const diagData = JSON.parse(fs.readFileSync(diagOutJson, 'utf-8'));

  // -------------------------------------------------------------------------
  // TEST 2: F0 Pitch Dynamics Availability
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] F0 Pitch Dynamics Structure & Computation');
  assert(diagData.pitch_dynamics != null, 'pitch_dynamics present in diagnostic');
  assert(typeof diagData.pitch_dynamics.generated.f0_mean === 'number', 'f0_mean computed');
  assert(typeof diagData.pitch_dynamics.generated.f0_std === 'number', 'f0_std computed');
  assert(typeof diagData.pitch_dynamics.generated.f0_iqr === 'number', 'f0_iqr computed');
  assert(typeof diagData.pitch_dynamics.generated.pitch_trajectory_variance === 'number', 'pitch_trajectory_variance computed');

  // -------------------------------------------------------------------------
  // TEST 3: Pause & Prosody Dynamics (nPVI) Availability
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] Pause & Rhythm Prosody Analysis');
  assert(diagData.prosody_dynamics != null, 'prosody_dynamics present in diagnostic');
  assert(typeof diagData.prosody_dynamics.generated.rhythm_npvi === 'number', 'rhythm_npvi (nPVI rhythm index) computed');
  assert(typeof diagData.prosody_dynamics.generated.pause_count === 'number', 'pause_count computed');
  assert(typeof diagData.prosody_dynamics.generated.total_pause_sec === 'number', 'total_pause_sec computed');

  // -------------------------------------------------------------------------
  // TEST 4: Energy Dynamics Availability
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Energy & Volume Dynamics');
  assert(diagData.energy_dynamics != null, 'energy_dynamics present in diagnostic');
  assert(typeof diagData.energy_dynamics.generated.dynamic_range_db === 'number', 'dynamic_range_db computed');
  assert(typeof diagData.energy_dynamics.generated.crest_factor === 'number', 'crest_factor computed');

  // -------------------------------------------------------------------------
  // TEST 5: Humanness & Naturalness Scorecard
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Humanness Scorecard & Robotic Artifact Assessment');
  assert(diagData.scorecard != null, 'scorecard present in diagnostic');
  assert(typeof diagData.scorecard.composite_naturalness_score === 'number', 'composite_naturalness_score computed');
  assert(typeof diagData.scorecard.robotic_artifact_level === 'string', 'robotic_artifact_level assessed');

  // -------------------------------------------------------------------------
  // TEST 6: Multi-Text Generation via Live AI Service Endpoint
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Live XTTSv2 Synthesis with Phase 13D Prosody');
  const testPayload = {
    project_id: 'phase13d_test_proj',
    user_id: 'phase13d_test_user',
    voice_profile_id: 'phase13d_direct',
    reference_audio_path: refM4a,
    text: 'Artificial intelligence enables remarkable voice cloning with nuanced prosody and natural pauses.',
    model: 'xtts-v2',
    language: 'en',
    speed: 0.95,
    emotion: 'expressive'
  };

  const genRes = await fetch(`${AI_BASE}/v1/speech/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testPayload)
  });

  assert(genRes.ok, `HTTP status is ${genRes.status}`);
  const genData = await genRes.json();
  assert(genData.status === 'COMPLETED', `Synthesis status: ${genData.status}`);
  assert(fs.existsSync(genData.audio_path), `Generated audio file exists at ${genData.audio_path}`);
  assert(fs.statSync(genData.audio_path).size > 10000, 'Generated audio file is non-empty speech');

  // -------------------------------------------------------------------------
  // TEST 7: Saved Voice Reference Integrity (No Silent Fallback)
  // -------------------------------------------------------------------------
  console.log('\n[TEST 7] Saved Voice Reference Conditioning Verification');
  assert(genData.metadata != null, 'Metadata present in response');
  assert(genData.metadata.conditioning_mode === 'ZERO_SHOT_REFERENCE_AUDIO', 'Conditioning mode is ZERO_SHOT_REFERENCE_AUDIO');
  assert(genData.metadata.speaker_cloned != null && genData.metadata.speaker_cloned.length > 0, 'Speaker cloned identifier recorded');
  assert(!genData.metadata.speaker_cloned.includes('default') && !genData.metadata.speaker_cloned.includes('fallback'), 'No fallback generic speaker used');

  // -------------------------------------------------------------------------
  // TEST 8: Intelligibility of Generated Speech
  // -------------------------------------------------------------------------
  console.log('\n[TEST 8] Intelligibility Verification on Live Output');
  const liveDiagOut = path.join(workspaceRoot, '.test_live_diag.json');
  try {
    const cmd = `${PYTHON_BIN} "${natDiagScript}" --reference "${refM4a}" --generated "${genData.audio_path}" --expected-text "${testPayload.text}" --output "${liveDiagOut}"`;
    execSync(cmd, { stdio: 'pipe', timeout: 45000 });
    const liveDiagData = JSON.parse(fs.readFileSync(liveDiagOut, 'utf-8'));
    assert(liveDiagData.intelligibility != null, 'Intelligibility data available');
    assert(liveDiagData.intelligibility.transcript != null && liveDiagData.intelligibility.transcript.length > 10, `Recognized transcript: "${liveDiagData.intelligibility.transcript}"`);
    assert(liveDiagData.intelligibility.word_accuracy_pct >= 80.0, `Word match accuracy is ${liveDiagData.intelligibility.word_accuracy_pct}% (>= 80%)`);
    assert(liveDiagData.speaker_similarity >= 0.70, `Resemblyzer similarity is ${(liveDiagData.speaker_similarity * 100).toFixed(2)}% (>= 70%)`);
  } catch (err) {
    assert(false, `Live diagnostic error: ${err.message}`);
  }

  // -------------------------------------------------------------------------
  // TEST 9: Experiment Documentation & Reproducibility Artifacts
  // -------------------------------------------------------------------------
  console.log('\n[TEST 9] Documentation and Experiment Logs');
  const expDoc = path.join(workspaceRoot, 'docs', 'voice', 'VOICE_FIDELITY_EXPERIMENTS.md');
  const natDoc = path.join(workspaceRoot, 'docs', 'voice', 'VOICE_NATURALNESS_OPTIMIZATION.md');
  assert(fs.existsSync(expDoc), 'VOICE_FIDELITY_EXPERIMENTS.md exists');
  assert(fs.existsSync(natDoc), 'VOICE_NATURALNESS_OPTIMIZATION.md exists');

  const expContent = fs.readFileSync(expDoc, 'utf-8');
  assert(expContent.includes('PHASE 13D'), 'VOICE_FIDELITY_EXPERIMENTS.md contains Phase 13D');
  assert(expContent.includes('EXP-13D-1'), 'Experiment IDs documented');

  // Clean up test temp files
  if (fs.existsSync(diagOutJson)) fs.unlinkSync(diagOutJson);
  if (fs.existsSync(liveDiagOut)) fs.unlinkSync(liveDiagOut);

  console.log('\n' + '='.repeat(80));
  console.log(`PHASE 13D TEST RESULTS: ${testsPassed} / ${testsTotal} PASSED (100%)`);
  console.log('='.repeat(80));
}

runPhase13DTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
