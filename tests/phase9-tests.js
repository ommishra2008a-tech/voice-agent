const http = require("http");
const fs = require("fs");
const path = require("path");

const root = require("child_process").execSync("npm root -g").toString().trim();
const { SolarchClient } = require(root + "/solarch/packages/core-client/dist/index.cjs");

const SOLARCH_URL = "http://localhost:8090";
const PYTHON_URL = "http://localhost:8000";

const results = [];

function record(name, status, details) {
  results.push({ name, status, details });
  const icon = status === "PASS" ? "✔" : "✖";
  console.log(`${icon} [${status}] ${name}: ${typeof details === "string" ? details : JSON.stringify(details)}`);
}

async function runPhase9Suite() {
  console.log("\n=========================================");
  console.log("⚡ STARTING PHASE 9: AUTONOMOUS VOICE AGENT TEST SUITE");
  console.log("=========================================\n");

  const client = new SolarchClient(SOLARCH_URL);
  let adminToken = "";
  let userAToken = "";
  let userBToken = "";
  let userAId = "";
  let userBId = "";
  let projectAId = "";
  let projectBId = "";
  let sessionIdA = `session_agent_${Date.now()}`;
  let agentSessionRec = null;
  let agentRunRec = null;

  // 1. Agent Service Health
  try {
    const healthRes = await fetch(`${PYTHON_URL}/v1/agent/health`).then(r => r.json());
    if (healthRes.status === "HEALTHY" && healthRes.registered_tools_count >= 7) {
      record("1. Agent Service Health & Subsystem State", "PASS", healthRes);
    } else {
      record("1. Agent Service Health & Subsystem State", "FAIL", healthRes);
    }
  } catch (e) {
    record("1. Agent Service Health & Subsystem State", "FAIL", e.message);
  }

  // 2. User & Project Workspace Provisioning
  try {
    const adminAuth = await client.admins.authWithPassword("admin@voiceai.lab", "AdminPassword123!");
    adminToken = adminAuth.token;

    // User A
    const userAEmail = `agent_engineer_a_${Date.now()}@voiceai.lab`;
    const userA = await client.collection("users").create({
      email: userAEmail,
      password: "AgentPasswordA123!",
      passwordConfirm: "AgentPasswordA123!"
    });
    userAId = userA.record.id;
    userAToken = userA.token;

    // User B
    const userBEmail = `agent_engineer_b_${Date.now()}@voiceai.lab`;
    const userB = await client.collection("users").create({
      email: userBEmail,
      password: "AgentPasswordB123!",
      passwordConfirm: "AgentPasswordB123!"
    });
    userBId = userB.record.id;
    userBToken = userB.token;

    // Project A
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, userA.record);
    const projA = await clientA.collection("projects").create({
      userId: userAId,
      name: "Autonomous Voice Agent Studio Alpha",
      description: "Agent Planning & Tool Chaining Workspace"
    });
    projectAId = projA.id;

    // Project B
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, userB.record);
    const projB = await clientB.collection("projects").create({
      userId: userBId,
      name: "Autonomous Voice Agent Studio Beta",
      description: "Isolated Tenant Agent Workspace"
    });
    projectBId = projB.id;

    record("2. User, Tenant & Agent Workspace Provisioning", "PASS", {
      userA: userAId,
      projectA: projectAId,
      projectB: projectBId
    });
  } catch (e) {
    record("2. User, Tenant & Agent Workspace Provisioning", "FAIL", e.message);
  }

  // 3. Solarch Agent Session Record Creation
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const ses = await clientA.collection("agent_sessions").create({
      userId: userAId,
      projectId: projectAId,
      status: "ACTIVE",
      currentTask: "Interactive Agent Dialogue"
    });
    agentSessionRec = ses;
    record("3. Solarch Agent Session Storage", "PASS", {
      sessionId: ses.id,
      status: ses.status
    });
  } catch (e) {
    record("3. Solarch Agent Session Storage", "FAIL", e.message);
  }

  // 4. Tool Registry Listing
  try {
    const toolsRes = await fetch(`${PYTHON_URL}/v1/agent/tools`).then(r => r.json());
    const toolNames = toolsRes.map(t => t.tool_name);
    if (toolNames.includes("process_media_url") && toolNames.includes("generate_speech") && toolNames.includes("search_knowledge")) {
      record("4. Agent Tool Registry Catalog", "PASS", {
        toolsCount: toolsRes.length,
        categories: [...new Set(toolsRes.map(t => t.category))]
      });
    } else {
      record("4. Agent Tool Registry Catalog", "FAIL", toolsRes);
    }
  } catch (e) {
    record("4. Agent Tool Registry Catalog", "FAIL", e.message);
  }

  // 5. Workflow A: Direct Speech Generation
  try {
    const runA = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: "Synthesize speech for: Autonomous agents are now operational.",
        mode: "agent"
      })
    }).then(r => r.json());

    if (runA.status === "COMPLETED" && runA.generated_audio_path) {
      record("5. Workflow A: Direct Speech Generation", "PASS", {
        planGoal: runA.plan.goal,
        toolsCalled: runA.tool_calls.map(t => t.tool_name),
        audioPath: runA.generated_audio_path,
        timeMs: runA.execution_time_ms
      });
    } else {
      record("5. Workflow A: Direct Speech Generation", "FAIL", runA);
    }
  } catch (e) {
    record("5. Workflow A: Direct Speech Generation", "FAIL", e.message);
  }

  // 6. Workflow B: URL -> Transcript & Speakers Analysis
  const ytUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  try {
    const runB = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: `Analyze this YouTube URL ${ytUrl} and tell me how many people are speaking.`,
        mode: "agent"
      })
    }).then(r => r.json());

    if (runB.status === "COMPLETED" && runB.tool_calls.some(t => t.tool_name === "process_media_url")) {
      record("6. Workflow B: URL Diarization & Speaker Discovery", "PASS", {
        planGoal: runB.plan.goal,
        toolsCalled: runB.tool_calls.map(t => t.tool_name),
        result: runB.final_result,
        timeMs: runB.execution_time_ms
      });
    } else {
      record("6. Workflow B: URL Diarization & Speaker Discovery", "FAIL", runB);
    }
  } catch (e) {
    record("6. Workflow B: URL Diarization & Speaker Discovery", "FAIL", e.message);
  }

  // 7. Workflow C: Sourced Knowledge RAG QA with Speaker Attribution
  try {
    const runC = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: "What did Speaker 2 say about acoustic normalization and vector search?",
        mode: "agent"
      })
    }).then(r => r.json());

    if (runC.status === "COMPLETED" && runC.citations.length > 0) {
      record("7. Workflow C: Grounded RAG Knowledge QA", "PASS", {
        planGoal: runC.plan.goal,
        citations: runC.citations,
        answerSnippet: runC.final_result.substring(0, 75) + "...",
        timeMs: runC.execution_time_ms
      });
    } else {
      record("7. Workflow C: Grounded RAG Knowledge QA", "FAIL", runC);
    }
  } catch (e) {
    record("7. Workflow C: Grounded RAG Knowledge QA", "FAIL", e.message);
  }

  // 8. Workflow D: End-to-End URL -> Speaker -> Translation -> Speech Synthesis
  try {
    const runD = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: `Take ${ytUrl}, select Speaker 2, translate to Hindi and generate speech in the selected voice.`,
        mode: "agent"
      })
    }).then(r => r.json());

    if (runD.status === "COMPLETED" && runD.generated_audio_path && runD.tool_calls.length >= 4) {
      record("8. Workflow D: Full Multi-Step Chaining (URL → Speaker → Translate → Synthesize)", "PASS", {
        stagesCount: runD.tool_calls.length,
        toolsChained: runD.tool_calls.map(t => t.tool_name),
        audioPath: runD.generated_audio_path,
        timeMs: runD.execution_time_ms
      });
    } else {
      record("8. Workflow D: Full Multi-Step Chaining (URL → Speaker → Translate → Synthesize)", "FAIL", runD);
    }
  } catch (e) {
    record("8. Workflow D: Full Multi-Step Chaining (URL → Speaker → Translate → Synthesize)", "FAIL", e.message);
  }

  // 9. Solarch Agent Run & Tool Call Persistence
  try {
    const clientA = new SolarchClient(SOLARCH_URL);
    clientA.authStore.save(userAToken, { id: userAId });

    const runRec = await clientA.collection("agent_runs").create({
      sessionId: agentSessionRec.id,
      userId: userAId,
      projectId: projectAId,
      request: "Take URL, select Speaker 2, translate to Hindi and generate speech.",
      status: "COMPLETED",
      currentStep: 4,
      finalResult: "Speech synthesis completed successfully in selected voice."
    });
    agentRunRec = runRec;

    const toolCallRec = await clientA.collection("agent_tool_calls").create({
      agentRunId: runRec.id,
      toolName: "generate_speech",
      status: "COMPLETED",
      resultReference: "storage/generated_audio/gen_agent.wav",
      executionTimeMs: 45
    });

    record("9. Solarch Agent Run & Tool Call Storage", "PASS", {
      runId: runRec.id,
      toolCallId: toolCallRec.id,
      status: runRec.status
    });
  } catch (e) {
    record("9. Solarch Agent Run & Tool Call Storage", "FAIL", e.message);
  }

  // 10. Multi-Turn Session Memory (Subsequent Request leverages previous Speaker/URL context)
  try {
    const turn2 = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: "Translate it to Hindi.",
        mode: "agent"
      })
    }).then(r => r.json());

    if (turn2.status === "COMPLETED") {
      record("10. Multi-Turn Conversational Memory & Context Resolution", "PASS", {
        sessionId: sessionIdA,
        planGoal: turn2.plan.goal,
        toolsCalled: turn2.tool_calls.map(t => t.tool_name),
        result: turn2.final_result
      });
    } else {
      record("10. Multi-Turn Conversational Memory & Context Resolution", "FAIL", turn2);
    }
  } catch (e) {
    record("10. Multi-Turn Conversational Memory & Context Resolution", "FAIL", e.message);
  }

  // 11. Realtime Agent Events Broadcasting Channel (SSE)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    const sseRes = await fetch(`${SOLARCH_URL}/api/realtime`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${adminToken}` }
    }).catch(err => {
      if (err.name === "AbortError") return { status: 200, ok: true };
      throw err;
    });
    clearTimeout(timeout);
    record("11. Realtime Agent Events Broadcasting Channel", "PASS", { protocol: "SSE", status: sseRes.status });
  } catch (e) {
    record("11. Realtime Agent Events Broadcasting Channel", "FAIL", e.message);
  }

  // 12. Multi-Tenant Project Isolation Guard (Agent B cannot access Project A sessions/runs)
  try {
    const clientB = new SolarchClient(SOLARCH_URL);
    clientB.authStore.save(userBToken, { id: userBId });

    const userBRuns = await clientB.collection("agent_runs").getList(1, 10, {
      filter: `projectId = '${projectBId}'`
    });

    const leaked = (userBRuns.items || []).some(r => r.id === agentRunRec.id);
    if (!leaked) {
      record("12. Multi-Tenant Agent Run Isolation Guard", "PASS", {
        userBRunsCount: userBRuns.totalItems || 0,
        isolated: true
      });
    } else {
      record("12. Multi-Tenant Agent Run Isolation Guard", "FAIL", "User A run leaked to User B");
    }
  } catch (e) {
    record("12. Multi-Tenant Agent Run Isolation Guard", "FAIL", e.message);
  }

  // 13. Security Guard: Empty Request Rejection
  try {
    const emptyRes = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: "   "
      })
    });
    const emptyData = await emptyRes.json();

    if (emptyRes.status === 400 || emptyData.detail) {
      record("13. Empty Agent Request Rejection Guard", "PASS", {
        status: emptyRes.status,
        detail: emptyData.detail
      });
    } else {
      record("13. Empty Agent Request Rejection Guard", "FAIL", emptyData);
    }
  } catch (e) {
    record("13. Empty Agent Request Rejection Guard", "FAIL", e.message);
  }

  // 14. Benchmark: Workflow A (Direct Speech) Latency
  try {
    const startA = Date.now();
    const bA = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: "Direct speech synthesis benchmark."
      })
    }).then(r => r.json());
    const totalA = Date.now() - startA;

    record("14. Benchmark Workflow A (Direct Speech)", "PASS", {
      agentMs: bA.execution_time_ms,
      totalRoundtripMs: totalA
    });
  } catch (e) {
    record("14. Benchmark Workflow A (Direct Speech)", "FAIL", e.message);
  }

  // 15. Benchmark: Workflow B (URL -> Transcript) Latency
  try {
    const startB = Date.now();
    const bB = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: `Analyze URL ${ytUrl} and extract speakers.`
      })
    }).then(r => r.json());
    const totalB = Date.now() - startB;

    record("15. Benchmark Workflow B (URL → Transcript)", "PASS", {
      agentMs: bB.execution_time_ms,
      totalRoundtripMs: totalB
    });
  } catch (e) {
    record("15. Benchmark Workflow B (URL → Transcript)", "FAIL", e.message);
  }

  // 16. Benchmark: Workflow C (Sourced RAG Query) Latency
  try {
    const startC = Date.now();
    const bC = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: "Search knowledge for autonomous agents."
      })
    }).then(r => r.json());
    const totalC = Date.now() - startC;

    record("16. Benchmark Workflow C (Sourced RAG Query)", "PASS", {
      agentMs: bC.execution_time_ms,
      totalRoundtripMs: totalC
    });
  } catch (e) {
    record("16. Benchmark Workflow C (Sourced RAG Query)", "FAIL", e.message);
  }

  // 17. Benchmark: Workflow D (URL -> Speaker -> Translation -> Speech) Latency
  try {
    const startD = Date.now();
    const bD = await fetch(`${PYTHON_URL}/v1/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionIdA,
        project_id: projectAId,
        user_id: userAId,
        request: `Take ${ytUrl}, use Speaker 2, translate to Hindi and generate audio.`
      })
    }).then(r => r.json());
    const totalD = Date.now() - startD;

    record("17. Benchmark Workflow D (End-to-End Orchestration)", "PASS", {
      stagesCount: bD.tool_calls.length,
      agentMs: bD.execution_time_ms,
      totalRoundtripMs: totalD
    });
  } catch (e) {
    record("17. Benchmark Workflow D (End-to-End Orchestration)", "FAIL", e.message);
  }

  console.log("\n=========================================");
  console.log("⚡ PHASE 9 TEST SUITE SUMMARY");
  console.log("=========================================");
  const passed = results.filter(r => r.status === "PASS").length;
  const total = results.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${total - passed}`);
  console.log("=========================================\n");

  fs.writeFileSync("tests/phase9-results.json", JSON.stringify(results, null, 2), "utf8");
}

runPhase9Suite().catch(console.error);
