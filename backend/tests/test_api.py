from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "sqlite_connected"


def test_task_crud_and_persistence():
    create_res = client.post(
        "/tasks",
        json={
            "title": "Quantum Mechanics Wavefunctions",
            "subject": "Physics",
            "priority": "high",
            "due_date": "2026-10-23",
            "estimated_minutes": 60,
        },
    )
    assert create_res.status_code == 201
    created_task = create_res.json()["task"]
    task_id = created_task["id"]

    list_res = client.get("/tasks")
    assert list_res.status_code == 200
    assert any(t["id"] == task_id for t in list_res.json()["tasks"])

    patch_res = client.patch(f"/tasks/{task_id}", json={"status": "completed"})
    assert patch_res.status_code == 200
    assert patch_res.json()["task"]["status"] == "completed"

    del_res = client.delete(f"/tasks/{task_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    missing_del = client.delete(f"/tasks/{task_id}")
    assert missing_del.status_code == 404


def test_multi_step_study_plan_chat():
    chat_res = client.post(
        "/chat",
        json={
            "message": "I have three physics topics and one chemistry assignment to finish by Friday.",
            "conversation_id": "pytest_session_01",
            "max_iterations": 5,
        },
    )
    assert chat_res.status_code == 200
    body = chat_res.json()
    assert len(body["tool_executions"]) >= 4
