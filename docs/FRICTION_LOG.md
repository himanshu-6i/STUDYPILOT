# Developer Friction Log
## StudyPilot AI — Amazon Developer Hackathon 2026

This log documents genuine technical issues encountered during development, expected vs. actual behavior, workarounds implemented, and recommendations.

---

### Friction Entry 1: Transparency Sorting Between Outer Refractive Glass Sphere and Inner Neural Filaments
- **Component**: `src/components/NeuralOrbScene3D.tsx` (Three.js `MeshPhysicalMaterial`)
- **Expected Result**: Placing branching emissive `TubeGeometry` neural filaments inside a transmissive `MeshPhysicalMaterial` sphere should render the inner filaments crisply from all camera angles.
- **Actual Result**: With default depth buffer settings (`depthWrite: true` on the outer sphere), inner filaments intermittently flickered or disappeared at grazing angles due to transparency depth-buffer occlusion.
- **Workaround Implemented**: Set `depthWrite: false` and explicit `renderOrder = 3` on the outer glass sphere mesh, paired with an additive Fresnel rim torus and `RoomEnvironment` PMREM reflections.
- **Improvement Suggestion**: Three.js `MeshPhysicalMaterial` documentation could highlight `depthWrite: false` + `renderOrder` best practices whenever `transmission > 0.8` encloses interior emissive geometry.

---

### Friction Entry 2: Duplicate Task Creation During Multi-Step Agent Retries
- **Component**: `src/server/agent.ts` (`executeValidatedAgentTool` -> `create_task`)
- **Expected Result**: When a user submits a multi-topic study goal, each topic should be created once in SQLite.
- **Actual Result**: During multi-iteration tool loops, an LLM occasionally re-invokes `create_task` with the same task title in a follow-up iteration if it also wants to call `retrieve_progress`.
- **Workaround Implemented**: Added `findDuplicatePendingTask(title, subject)` in `StudyPilotRepository` (`src/server/database.ts`) to check for an existing `pending` task with the same case-insensitive title and subject before inserting, returning `deduplicated: true` with the existing task record.

---

### Friction Entry 3: Headless Browser Software WebGL Rendering Latency with CSS Backdrop Filters
- **Component**: UI HUD overlays (`src/App.tsx`, `src/components/TaskModal.tsx`) over active Three.js `<canvas>`
- **Expected Result**: Overlaying translucent HUD panels on top of a full-viewport Three.js scene should render without frame drops in both desktop GPUs and headless Chromium test runners.
- **Actual Result**: Combining CSS `backdrop-filter: blur(...)` over a continuous `requestAnimationFrame` WebGL canvas causes high CPU compositing overhead in software-rendered headless browsers.
- **Workaround Implemented**: Replaced CSS `backdrop-blur` overlays with high-contrast semi-opaque dark surfaces (`bg-[#081022]/95`) and throttled headless rendering (`navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent)`) to ~15 FPS with `pixelRatio = 1`.
