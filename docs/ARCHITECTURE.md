# StudyPilot AI — System Architecture
## Amazon Developer Hackathon 2026 | Alexa+ Simulated Experience

### 1. Overview & Simulation Boundary
**StudyPilot AI** is an independent browser-based 3D spatial productivity agent built for the **Alexa+ — Simulated Experience** track of the Amazon Developer Hackathon 2026. It is not an official Amazon product or hardware Alexa integration.

### 2. Four-Layer Architecture

#### Layer A: 3D Spatial Frontend (`src/`)
- **Interactive 3D Neural Study Core (`src/components/NeuralOrbScene3D.tsx`)**: Built with Three.js (`THREE.WebGLRenderer`, `RoomEnvironment` + `PMREMGenerator`, `ACESFilmicToneMapping`). Features a refractive optical glass sphere, 3D branching dendritic neural filaments (`TubeGeometry` + `InstancedMesh` synaptic nodes), inclined orbital rings, deep-space constellation network lines, and 6 orbiting 3D holographic glass study cards textured dynamically from live SQLite task and progress records.
- **Spatial Workspace Views**:
  - `OverviewView.tsx`: Left-aligned spatial command HUD leaving the center-right 3D Neural Orb unobstructed.
  - `TasksView.tsx`: Full task CRUD, status/priority/subject filters, live search, and 2-step delete confirmation.
  - `StudyPlannerView.tsx`: Multi-step study goal decomposer and subject-grouped progress matrix.
  - `ActivityView.tsx`: Real-time backend tool execution audit log with credential redaction.
  - `SettingsView.tsx`: Live `/health` verifier, bounded tool-loop iteration limit configuration, and security disclosures.
  - `AgentChatPanel.tsx`: Stateful multi-turn AI Co-Pilot with inline tool execution traces and error retry.

#### Layer B: Backend API (`server.ts` & `backend/app/main.py`)
- Exposes REST endpoints (`GET /health`, `GET /tasks`, `POST /tasks`, `PATCH /tasks/:task_id`, `DELETE /tasks/:task_id`, `POST /chat`, `GET /activity`, plus `/api/*` equivalents).
- Strict payload validation (`src/lib/validation.ts` and `backend/app/schemas.py`).

#### Layer C: Agent Orchestration & Validated Tools (`src/server/agent.ts`)
- Isolates model provider logic behind `ModelProviderAdapter` (`GeminiModelAdapter` via `@google/genai`, `OpenAICompatibleAdapter` for OpenAI `/v1/chat/completions`, and `StructuredStudyAgentFallbackAdapter` when running without external API credentials).
- Enforces a strict server-side upper bound (`max_iterations` between 1 and 8, default 5) on tool-calling loops.
- Narrowly scoped validated backend tools:
  - `create_task` (with automatic deduplication of identical pending tasks)
  - `list_tasks`
  - `update_task`
  - `complete_task`
  - `delete_task` (requires explicit numeric `task_id` and `confirm=true`)
  - `retrieve_progress`

#### Layer D: SQLite Persistence (`src/server/database.ts` & `backend/app/database.py`)
- Uses parameterized SQL statements over SQLite in WAL mode (`tasks`, `conversations`, and `agent_activity` tables).
- Preserves tasks, completion progress, conversation history, and tool execution audit logs across browser reloads and server restarts.

### 3. Security & Current Limitations
- API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`) are read strictly on the backend and never exposed to client bundles.
- All tool arguments are validated prior to execution; no arbitrary code, shell, or raw SQL execution is permitted.
- **MVP Limitation**: This hackathon MVP operates as a single-workspace environment without multi-user authentication (OAuth/JWT) or per-tenant row-level isolation. Production deployment for multiple users requires adding authentication middleware and user-scoped foreign keys on the `tasks`, `conversations`, and `agent_activity` tables.
