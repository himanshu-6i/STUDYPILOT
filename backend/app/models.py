from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text
from .database import Base


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskModel(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False, default="")
    subject = Column(String(80), nullable=False, default="General")
    priority = Column(String(20), nullable=False, default="medium")
    status = Column(String(20), nullable=False, default="pending")
    due_date = Column(String(32), nullable=True)
    estimated_minutes = Column(Integer, nullable=False, default=45)
    created_at = Column(String(40), nullable=False, default=utc_now_iso)
    updated_at = Column(String(40), nullable=False, default=utc_now_iso)


class AgentActivityModel(Base):
    __tablename__ = "agent_activity"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(80), nullable=False, index=True)
    tool_name = Column(String(64), nullable=False)
    action_description = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="success")
    arguments_summary = Column(Text, nullable=False, default="{}")
    result_summary = Column(Text, nullable=False, default="")
    duration_ms = Column(Integer, nullable=False, default=0)
    created_at = Column(String(40), nullable=False, default=utc_now_iso)
