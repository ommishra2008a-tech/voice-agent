"""
Versioned Data Contracts for Autonomous Voice AI Agent Engine
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class ToolDefinition(BaseModel):
    tool_name: str
    category: str  # "SOURCE" | "AUDIO" | "VOICE" | "RAG" | "LANGUAGE" | "GENERATION" | "SOLARCH"
    description: str
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    timeout_seconds: float = 30.0


class ToolCallExecution(BaseModel):
    tool_call_id: str
    agent_run_id: str
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    status: str  # "STARTED" | "COMPLETED" | "FAILED"
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    execution_time_ms: int = 0


class AgentPlanStep(BaseModel):
    step_index: int
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)
    intent: str
    dependencies: List[int] = Field(default_factory=list)


class AgentPlan(BaseModel):
    goal: str
    steps: List[AgentPlanStep]
    estimated_time_ms: int = 100


class AgentRunRequest(BaseModel):
    session_id: Optional[str] = None
    project_id: str
    user_id: str
    request: str
    mode: str = "agent"  # "agent" | "direct"


class AgentRunResponse(BaseModel):
    run_id: str
    session_id: str
    project_id: str
    status: str  # "COMPLETED" | "FAILED"
    request: str
    plan: AgentPlan
    tool_calls: List[ToolCallExecution]
    final_result: str
    generated_audio_path: Optional[str] = None
    citations: List[str] = Field(default_factory=list)
    execution_time_ms: int
    error: Optional[str] = None
