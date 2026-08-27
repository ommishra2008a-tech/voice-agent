"""
FastAPI AI Service Main Application
Autonomous Voice AI Lab
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router as health_router
from app.routes.media import router as media_router
from app.routes.speech import router as speech_router
from app.routes.voice import router as voice_router
from app.routes.generation import router as generation_router
from app.routes.rag import router as rag_router
from app.routes.translation import router as translation_router
from app.routes.media_source import router as media_source_router
from app.routes.agent import router as agent_router
from app.routes.benchmark import router as benchmark_router

app = FastAPI(
    title="Autonomous Voice AI Service",
    description="High-performance media ingestion, normalization, STT, and voice synthesis execution layer",
    version="1.0.0"
)

# CORS configuration for local development & Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(media_router)
app.include_router(speech_router)
app.include_router(voice_router)
app.include_router(generation_router)
app.include_router(rag_router)
app.include_router(translation_router)
app.include_router(media_source_router)
app.include_router(agent_router)
app.include_router(benchmark_router)

@app.get("/health")
def root_health():
    return {"status": "healthy", "service": "autonomous-voice-ai-service", "version": "1.0.0"}

@app.get("/")
def root():
    return {"status": "online", "message": "Autonomous Voice AI Platform ML Engine"}




if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
