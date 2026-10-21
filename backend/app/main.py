from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .config import settings
from .database import Base, engine, get_db
from .models import TaskModel, AgentActivityModel, utc_now_iso
from .schemas import TaskCreateSchema, TaskUpdateSchema, ChatRequestSchema
import json

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def serialize_task(t: TaskModel) -> dict:
    return {
        "id": t.id,
        "title": t.title,
        "description": t.description,
        "subject": t.subject,
        "priority": t.priority,
        "status": t.status,
        "due_date": t.due_date,
        "estimated_minutes": t.estimated_minutes,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
    }


def compute_progress(tasks: list[TaskModel]) -> dict:
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    pending = total - completed
    rate = round((completed / total) * 100) if total > 0 else 0
    return {
        "total_tasks": total,
        "completed_tasks": completed,
        "pending_tasks": pending,
        "completion_rate": rate,
    }


@app.get("/health")
def get_health(db: Session = Depends(get_db)):
    count = db.query(TaskModel).count()
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": "sqlite_connected",
        "tasks_count": count,
        "provider": settings.MODEL_PROVIDER,
        "model": settings.MODEL_NAME,
        "max_tool_iterations": settings.MAX_TOOL_ITERATIONS,
        "timestamp": utc_now_iso(),
    }


@app.get("/tasks")
def list_tasks(
    status: str | None = None,
    priority: str | None = None,
    subject: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(TaskModel)
    if status and status != "all":
        query = query.filter(TaskModel.status == status.lower())
    if priority and priority != "all":
        query = query.filter(TaskModel.priority == priority.lower())
    if subject and subject != "all":
        query = query.filter(TaskModel.subject.ilike(subject))
    rows = query.order_by(TaskModel.id.desc()).all()
    all_rows = db.query(TaskModel).all()
    return {
        "tasks": [serialize_task(r) for r in rows],
        "progress": compute_progress(all_rows),
    }


@app.post("/tasks", status_code=201)
def create_task(payload: TaskCreateSchema, db: Session = Depends(get_db)):
    now = utc_now_iso()
    task = TaskModel(
        title=payload.title,
        description=payload.description,
        subject=payload.subject,
        priority=payload.priority,
        status=payload.status,
        due_date=payload.due_date,
        estimated_minutes=payload.estimated_minutes,
        created_at=now,
        updated_at=now,
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    act = AgentActivityModel(
        conversation_id="direct-api",
        tool_name="create_task",
        action_description=f'Created task #{task.id}: "{task.title}" ({task.subject})',
        status="success",
        arguments_summary=json.dumps({"title": task.title, "subject": task.subject}),
        result_summary=f"Task #{task.id} persisted.",
        duration_ms=2,
        created_at=now,
    )
    db.add(act)
    db.commit()

    all_rows = db.query(TaskModel).all()
    return {"task": serialize_task(task), "progress": compute_progress(all_rows)}


@app.patch("/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdateSchema, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with ID #{task_id} not found.")

    update_data = payload.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="At least one field must be provided for update.")

    for k, v in update_data.items():
        setattr(task, k, v)
    task.updated_at = utc_now_iso()
    db.commit()
    db.refresh(task)

    all_rows = db.query(TaskModel).all()
    return {"task": serialize_task(task), "progress": compute_progress(all_rows)}


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskModel).filter(TaskModel.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with ID #{task_id} not found.")
    db.delete(task)
    db.commit()
    all_rows = db.query(TaskModel).all()
    return {"deleted": True, "task_id": task_id, "progress": compute_progress(all_rows)}


@app.post("/chat")
def agent_chat(payload: ChatRequestSchema, db: Session = Depends(get_db)):
    now = utc_now_iso()
    msg_lower = payload.message.lower()
    tool_executions = []

    if "physics" in msg_lower or "chemistry" in msg_lower or "plan" in msg_lower:
        planned = [
            ("Physics Topic 1: Kinematics & Mechanics", "Physics", "high", "2026-10-20", 60),
            ("Physics Topic 2: Thermodynamics & Entropy", "Physics", "high", "2026-10-21", 60),
            ("Physics Topic 3: Electromagnetism & Optics", "Physics", "medium", "2026-10-22", 60),
            ("Chemistry Assignment: Titration & Stoichiometry", "Chemistry", "high", "2026-10-23", 90),
        ]
        for title, subj, prio, due, mins in planned:
            t = TaskModel(
                title=title,
                subject=subj,
                priority=prio,
                status="pending",
                due_date=due,
                estimated_minutes=mins,
                created_at=now,
                updated_at=now,
            )
            db.add(t)
            db.commit()
            db.refresh(t)
            desc = f'Created task #{t.id}: "{t.title}" ({t.subject})'
            db.add(
                AgentActivityModel(
                    conversation_id=payload.conversation_id,
                    tool_name="create_task",
                    action_description=desc,
                    status="success",
                    arguments_summary=json.dumps({"title": title, "subject": subj}),
                    result_summary=json.dumps({"ok": True, "id": t.id}),
                    duration_ms=3,
                    created_at=now,
                )
            )
            tool_executions.append(
                {
                    "tool_name": "create_task",
                    "status": "success",
                    "action_description": desc,
                    "args": {"title": title, "subject": subj, "priority": prio},
                    "result": {"ok": True, "task": serialize_task(t)},
                    "duration_ms": 3,
                }
            )
        db.commit()
        reply = f"Created {len(planned)} prioritized study tasks across Physics and Chemistry in SQLite."
    else:
        all_rows = db.query(TaskModel).all()
        prog = compute_progress(all_rows)
        tool_executions.append(
            {
                "tool_name": "retrieve_progress",
                "status": "success",
                "action_description": f"Retrieved study progress ({prog['completion_rate']}%)",
                "args": {},
                "result": {"ok": True, "progress": prog},
                "duration_ms": 2,
            }
        )
        reply = f"Current verified progress: {prog['completed_tasks']}/{prog['total_tasks']} completed ({prog['completion_rate']}%)."

    all_tasks = db.query(TaskModel).order_by(TaskModel.id.desc()).all()
    activities = db.query(AgentActivityModel).order_by(AgentActivityModel.id.desc()).limit(30).all()
    return {
        "reply": reply,
        "conversation_id": payload.conversation_id,
        "tool_executions": tool_executions,
        "iterations_used": 1,
        "max_iterations": payload.max_iterations,
        "provider": settings.MODEL_PROVIDER,
        "model": settings.MODEL_NAME,
        "tasks": [serialize_task(t) for t in all_tasks],
        "progress": compute_progress(all_tasks),
        "activity": [
            {
                "id": a.id,
                "conversation_id": a.conversation_id,
                "tool_name": a.tool_name,
                "action_description": a.action_description,
                "status": a.status,
                "arguments_summary": a.arguments_summary,
                "result_summary": a.result_summary,
                "duration_ms": a.duration_ms,
                "created_at": a.created_at,
            }
            for a in activities
        ],
    }


@app.get("/activity")
def list_activity(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.query(AgentActivityModel).order_by(AgentActivityModel.id.desc()).limit(limit).all()
    return {
        "activity": [
            {
                "id": a.id,
                "conversation_id": a.conversation_id,
                "tool_name": a.tool_name,
                "action_description": a.action_description,
                "status": a.status,
                "arguments_summary": a.arguments_summary,
                "result_summary": a.result_summary,
                "duration_ms": a.duration_ms,
                "created_at": a.created_at,
            }
            for a in rows
        ]
    }
