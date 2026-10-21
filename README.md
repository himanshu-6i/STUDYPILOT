# StudyPilot AI — Your Intelligent 3D Study & Productivity Agent
### Amazon Developer Hackathon 2026 | Alexa+ Simulated Experience

> **Disclaimer**: StudyPilot AI is an independent browser-based simulation of an intelligent, stateful assistant built for the **Alexa+ — Simulated Experience** hackathon track. It is not an official Amazon product or an actual hardware Alexa integration.

---

## 1. Project Overview

**StudyPilot AI** converts student academic goals, multi-topic assignments, and deadlines into actionable, prioritized study plans inside an interactive **3D Spatial WebGL Environment**.

At the center of the workspace is a **3D Glass Neural Study Core** built with Three.js—featuring a refractive optical glass sphere, branching bioluminescent neural filaments that pulse during agent tool execution, and **6 orbiting 3D holographic study plan cards** dynamically rendered from real SQLite task records.

### Implemented Capabilities (Added During Hackathon Period)
- **Interactive 3D Neural Orb & Holographic Task Cards (`src/components/NeuralOrbScene3D.tsx`)**: Real-time Three.js scene with 4 camera presets (`Orbital Hero`, `Neural Core`, `Wide Orbit`, `Top Matrix`), adjustable holographic ring radius, orbit speed controls, and raycasted 3D card selection.
- **Stateful AI Agent Chat (`POST /chat` & `POST /api/chat`)**: Multi-turn conversational assistant with persistent `conversation_id`, configurable bounded tool-call loop (`max_iterations` 1–8), and provider adapter architecture (`@google/genai` Gemini 3.8 Flash, OpenAI compatible `/v1/chat/completions`, and deterministic structured tool fallback).
- **Validated Narrow Agent Tools (`src/server/agent.ts`)**:
  - `create_task` (with automatic duplicate pending task prevention)
  - `list_tasks`
  - `update_task`
  - `complete_task`
  - `delete_task` (enforces explicit numeric `task_id` and `confirm=true`)
  - `retrieve_progress`
- **Full Task CRUD & Filtering (`GET/POST /tasks`, `PATCH/DELETE /tasks/:id`)**: Create, list, edit, complete, and delete tasks with priority levels (`low`, `medium`, `high`), academic subjects, estimated study minutes, and due dates persisted in SQLite (`studypilot.db`).
- **AI Study Planner (`src/components/StudyPlannerView.tsx`)**: Decomposes multi-subject study goals into prioritized tasks grouped by academic subject with workload progress bars.
- **Verified Agent Activity Audit Log (`GET /activity`)**: Records every backend tool invocation, timestamp, execution latency (`ms`), outcome status, and sanitized arguments with automatic credential redaction.

---

## 2. Repository Structure

```text
studypilot-ai/
  src/
    components/
      NeuralOrbScene3D.tsx    # Interactive Three.js 3D glass neural orb & orbiting holo-cards
      OverviewView.tsx        # Spatial HUD dashboard, KPI telemetry, priority queue
      TasksView.tsx           # Full task CRUD table, status/priority/subject filters, search
      StudyPlannerView.tsx    # Multi-step AI goal decomposer & subject matrix
      ActivityView.tsx        # Real backend tool execution audit log
      SettingsView.tsx        # Live /health inspector, tool loop config, disclosures
      AgentChatPanel.tsx      # Conversational AI Co-Pilot with tool trace & retry
      TaskModal.tsx           # Accessible modal for creating/editing tasks
    lib/
      validation.ts           # Pure input schemas, progress calculators, log sanitizers
      validation.test.ts      # Node native unit tests for validation & metrics
      api.ts                  # Typed frontend API client
    server/
      database.ts             # SQLite repository (tasks, conversations, agent_activity)
      agent.ts                # Validated tool registry, model adapters, bounded loop
      agent.test.ts           # Automated integration tests for SQLite & agent tools
    App.tsx                   # Main 3D spatial workspace & collapsible bottom control dock
  backend/                    # Reference Python FastAPI + SQLAlchemy + Pydantic service
    app/
      main.py
      config.py
      database.py
      models.py
      schemas.py
    tests/
      test_api.py
    requirements.txt
    .env.example
  docs/
    ARCHITECTURE.md
    PRODUCT_FEEDBACK.md
    FRICTION_LOG.md
  server.ts                   # Full-stack Express + Vite + SQLite server (port 3000)
  .env.example
  package.json
  README.md
  LICENSE
```

---

## 3. Reproducible Local Setup & Testing Instructions

### Prerequisites
- Node.js 22+ (includes native `node:sqlite` and `node:test`)
- npm 10+

### Step 1: Install Dependencies & Configure Environment
```bash
npm install
cp .env.example .env
# Optional: Set GEMINI_API_KEY or OPENAI_API_KEY in .env
```

### Step 2: Run Automated Unit & Backend Integration Tests
```bash
npm test
```

### Step 3: Build Production Bundle & Start Full-Stack Server
```bash
npm run build
npm run dev
# Application runs at http://localhost:3000
```

---

## 4. Under-3-Minute Demo Video Script (Alexa+ Simulated Experience)

- **0:00 – 0:30 | Introduction & 3D Neural Study Core**:
  - Open StudyPilot AI at `http://localhost:3000`. Show the 3D Glass Neural Orb and orbiting holographic `Study plans` cards rendered in real time from SQLite. Use the bottom 3D control dock to orbit the camera (`Orbital Hero` -> `Neural Core` -> `Wide Orbit`).
- **0:30 – 1:25 | Multi-Step AI Study Planning Workflow**:
  - Open the **AI Agent Co-Pilot** or click **Generate 3D Study Plan** with the prompt:
    *"I have three physics topics and one chemistry assignment to finish by Friday. Create a realistic study plan, prioritize everything, and help me track my progress."*
  - Watch the 3D Neural Orb pulse while the backend agent executes `create_task` (x4) and `retrieve_progress`, displaying verified tool call badges and latency in milliseconds.
- **1:25 – 2:10 | Task Completion, 3D Holo-Card Sync & Browser Refresh Persistence**:
  - Navigate to **My Tasks** or click the completion toggle on a Physics task. Observe the completion rate jump immediately and the 3D orbiting gauge card update.
  - Refresh the browser page (`Ctrl+R` / `Cmd+R`). Point out that all created tasks, completed statuses, and conversation history remain persisted in SQLite.
- **2:10 – 2:45 | Agent Activity Audit Log & Health Verification**:
  - Open **Activity** to show the timestamped backend tool executions (`create_task`, `complete_task`, `retrieve_progress`) with sanitized arguments.
  - Open **Settings** and click **Verify GET /health** to confirm live SQLite connection and bounded tool iteration guardrails.

---

## 5. Alexa+ Submission Checklist
- [x] Working 3D spatial web application with real SQLite persistence.
- [x] Demonstrable multi-step AI workflow decomposing goals into persisted tasks.
- [x] Narrowly scoped, validated backend tools with bounded iteration limit.
- [x] Source code, `.env.example`, and reproducible setup instructions in `README.md`.
- [x] Honest Product Feedback (`docs/PRODUCT_FEEDBACK.md`) and Friction Log (`docs/FRICTION_LOG.md`).
- [x] Clear disclosure as an independent Alexa+ Simulated Experience.
