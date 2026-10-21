# Product Feedback — Tools, SDKs & Runtime Used
## Amazon Developer Hackathon 2026 | StudyPilot AI

This document records honest, concrete developer feedback on the tools, APIs, and SDKs used to build and test **StudyPilot AI**.

### 1. Google GenAI SDK (`@google/genai`) & OpenAI Function Calling Adapter
- **What Worked Well**:
  - Defining strongly typed `FunctionDeclaration` schemas (`create_task`, `list_tasks`, `update_task`, `complete_task`, `delete_task`, `retrieve_progress`) using `Type.OBJECT`, `Type.STRING`, `Type.INTEGER`, and `Type.BOOLEAN` made multi-tool orchestration clean and predictable.
  - Isolating model invocation behind our `ModelProviderAdapter` interface allowed us to support both `@google/genai` (`gemini-3.8-flash`) and OpenAI's `/v1/chat/completions` tool-calling contract without leaking SDK-specific response shapes into the database or route handlers.
- **Constructive Improvement Suggestion**:
  - When a model emits multiple parallel `functionCalls` in a single turn (for example, calling `create_task` four times for a multi-topic study plan and `retrieve_progress` once), having built-in SDK middleware for sequential vs. transactional tool execution hooks would reduce boilerplate in bounded agent loops.

### 2. Node.js Native SQLite (`node:sqlite`) & SQLAlchemy SQLite
- **What Worked Well**:
  - Node 22's built-in `DatabaseSync` from `node:sqlite` eliminated native C++ compilation bottlenecks while providing synchronous prepared statements (`db.prepare(...).run(...)`) and WAL mode support.
  - Pairing `node:sqlite` for the unified port-3000 full-stack runtime with SQLAlchemy + FastAPI in `backend/` ensured reproducible local and container execution.
- **Constructive Improvement Suggestion**:
  - `node:sqlite` currently logs an `ExperimentalWarning` on process startup. Promoting `node:sqlite` to stable status and adding built-in migration versioning helpers would streamline lightweight agent state persistence.

### 3. Three.js (`three` r170+) for 3D Spatial Web Interfaces
- **What Worked Well**:
  - `MeshPhysicalMaterial` with `transmission`, `ior`, `clearcoat`, and `RoomEnvironment` + `PMREMGenerator` produced realistic optical glass refraction around the internal branching `TubeGeometry` neural filaments without requiring external `.hdr` asset downloads.
  - Dynamic HTML5 2D `<canvas>` textures (`THREE.CanvasTexture`) bound to orbiting 3D planes allowed real SQLite task records and completion gauges to render directly in 3D space at 60 FPS.
