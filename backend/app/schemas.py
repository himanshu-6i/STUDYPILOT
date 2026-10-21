from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator


class TaskCreateSchema(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    subject: str = Field(default="General", min_length=1, max_length=80)
    priority: Literal["low", "medium", "high"] = "medium"
    status: Literal["pending", "completed"] = "pending"
    due_date: Optional[str] = None
    estimated_minutes: int = Field(default=45, ge=5, le=600)

    @field_validator("title", "subject")
    @classmethod
    def must_not_be_blank(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Field cannot be blank or whitespace only.")
        return trimmed


class TaskUpdateSchema(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    subject: Optional[str] = Field(default=None, min_length=1, max_length=80)
    priority: Optional[Literal["low", "medium", "high"]] = None
    status: Optional[Literal["pending", "completed"]] = None
    due_date: Optional[str] = None
    estimated_minutes: Optional[int] = Field(default=None, ge=5, le=600)


class ChatRequestSchema(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversation_id: str = Field(default="default-session", pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    max_iterations: int = Field(default=5, ge=1, le=8)
