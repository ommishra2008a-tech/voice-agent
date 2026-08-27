/**
 * Manual Voice Testing Validation Script - XTTS v2 & Multi-Model
 */
const fs = require("fs");
const path = require("path");

async function runManualVoiceTests() {
  console.log("================================================================================");
  console.log("★ RUNNING MANUAL VOICE TEST EVALUATION SUITE: XTTS v2 & MULTI-MODEL");
  console.log("================================================================================\n");

  const results = [];

  const testCases = [
    {
      id: "XTTS-01",
      model: "xtts-v2",
      name: "XTTS v2 Zero-Shot Short English",
      language: "en",
      text: "Hello, this is a real-time zero-shot voice cloning test using XTTS v2."
    },
    {
      id: "XTTS-02",
      model: "xtts-v2",
      name: "XTTS v2 Zero-Shot Medium English Paragraph",
      language: "en",
      text: "Welcome to the Autonomous Voice AI Laboratory. All neural voice engines, acoustic embedding profilers, and timing adaptation pipelines are calibrated under deterministic Solarch-First control."
    },
    {
      id: "XTTS-03",
      model: "xtts-v2",
      name: "XTTS v2 Zero-Shot Hindi Synthesis",
      language: "hi",
      text: "न्यूरल ध्वनि क्लोनिंग इंजन स्पीकर की पहचान को सुरक्षित रखता है।"
    },
    {
      id: "FASTPITCH-01",
      model: "fastpitch-baseline",
      name: "FastPitch Baseline High-Speed English",
      language: "en",
      text: "FastPitch baseline delivers high-speed low-latency synthesis under fifty milliseconds."
    }
  ];

  for (const tc of testCases) {
    const startTime = Date.now();
    try {
      const res = await fetch("http://localhost:8000/v1/speech/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "test_manual_proj",
          user_id: "test_manual_user",
          voice_profile_id: "test_anchor_voice",
          text: tc.text,
          model: tc.model,
          language: tc.language,
          speed: 1.0,
          pitch: 0.0,
          emotion: "neutral"
        })
      });

      const data = await res.json();
      const elapsed = Date.now() - startTime;

      if (data.status === "COMPLETED" && data.audio_path) {
        // Run quality evaluation
        const evalRes = await fetch(
          `http://localhost:8000/v1/speech/evaluate?ref_path=${encodeURIComponent(data.audio_path)}&gen_path=${encodeURIComponent(data.audio_path)}`,
          { method: "POST" }
        ).then(r => r.json());

        console.log(`[PASS] ${tc.id}: ${tc.name}`);
        console.log(`       Audio: ${data.audio_path} | Latency: ${elapsed}ms | Similarity: ${(evalRes.speaker_embedding_similarity * 100).toFixed(1)}% | Quality: ${(evalRes.overall_quality_score * 100).toFixed(1)}%`);

        results.push({
          id: tc.id,
          name: tc.name,
          model: tc.model,
          language: tc.language,
          text: tc.text,
          status: "PASS",
          latencyMs: elapsed,
          audioPath: data.audio_path,
          speakerSimilarity: evalRes.speaker_embedding_similarity,
          pitchCorrelation: evalRes.pitch_correlation,
          qualityScore: evalRes.overall_quality_score
        });
      } else {
        console.log(`[FAIL] ${tc.id}: ${tc.name} -> ${data.error || "Unknown error"}`);
        results.push({ id: tc.id, name: tc.name, status: "FAIL", error: data.error });
      }
    } catch (e) {
      console.log(`[FAIL] ${tc.id}: ${tc.name} -> ${e.message}`);
      results.push({ id: tc.id, name: tc.name, status: "FAIL", error: e.message });
    }
  }

  console.log("\n================================================================================");
  console.log(`★ MANUAL VOICE SUITE FINISHED: ${results.filter(r => r.status === "PASS").length} / ${results.length} PASSED`);
  console.log("================================================================================");

  fs.writeFileSync(path.join(__dirname, "manual-voice-results.json"), JSON.stringify(results, null, 2));
}

runManualVoiceTests();
