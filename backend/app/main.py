"""
Main FastAPI application for RPG Narrative Engine
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db
from .routes import campaigns, game

# Create FastAPI app
app = FastAPI(
    title="RPG Narrative Engine API",
    description="Backend API for a narrative RPG game with campaign editor",
    version="1.0.0"
)

# Configure CORS (allow frontend to access API)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(campaigns.router)
app.include_router(game.router)


@app.on_event("startup")
def startup_event():
    """Initialize database on startup"""
    init_db()
    print("Database initialized!")


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "RPG Narrative Engine API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
