import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    PROJECT_NAME: str = "StudyPilot AI Backend (Alexa+ Simulated Experience)"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./studypilot_fastapi.db")
    MODEL_PROVIDER: str = os.getenv("MODEL_PROVIDER", "openai")
    MODEL_NAME: str = os.getenv("MODEL_NAME", "gpt-4o-mini")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    MAX_TOOL_ITERATIONS: int = min(8, max(1, int(os.getenv("MAX_TOOL_ITERATIONS", "5"))))
    CORS_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
        if o.strip()
    ]


settings = Settings()
