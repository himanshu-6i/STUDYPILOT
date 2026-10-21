import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { StudyPilotRepository } from './src/server/database.ts';
import { createConfiguredModelAdapter, runStudyPilotAgentTurn } from './src/server/agent.ts';
import {
  calculateProgressMetrics,
  validateChatRequest,
  validateCreateTaskInput,
  validateUpdateTaskInput,
} from './src/lib/validation.ts';

export function createStudyPilotApp(customRepo?: StudyPilotRepository) {
  const repo = customRepo ?? new StudyPilotRepository();
  repo.seedIfEmpty();

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Configurable CORS middleware
  const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 1. Health Endpoint
  const handleHealth = (_req: Request, res: Response) => {
    try {
      const adapter = createConfiguredModelAdapter(repo);
      const tasks = repo.listTasks();
      res.status(200).json({
        status: 'healthy',
        service: 'StudyPilot AI Backend (Alexa+ Simulated Experience)',
        database: 'sqlite_connected',
        tasks_count: tasks.length,
        provider: adapter.providerName,
        model: adapter.modelName,
        max_tool_iterations: Number(process.env.MAX_TOOL_ITERATIONS) || 5,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({
        status: 'unhealthy',
        error: err instanceof Error ? err.message : 'Database health check failed.',
      });
    }
  };
  app.get(['/health', '/api/health'], handleHealth);

  // 2. List Tasks Endpoint
  const handleListTasks = (req: Request, res: Response) => {
    try {
      const filters = {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
        subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      };
      const tasks = repo.listTasks(filters);
      const allTasks = repo.listTasks();
      const progress = calculateProgressMetrics(allTasks);
      res.status(200).json({
        tasks,
        progress,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to list tasks.',
      });
    }
  };
  app.get(['/tasks', '/api/tasks'], handleListTasks);

  // 3. Create Task Endpoint
  const handleCreateTask = (req: Request, res: Response) => {
    const validation = validateCreateTaskInput(req.body);
    if (!validation.valid || !validation.data) {
      res.status(400).json({ error: validation.error || 'Invalid task input.' });
      return;
    }
    try {
      const created = repo.createTask(validation.data);
      repo.logActivity({
        conversation_id: 'direct-ui',
        tool_name: 'create_task',
        action_description: `Created task #${created.id}: "${created.title}" (${created.subject}, ${created.priority} priority)`,
        status: 'success',
        arguments_summary: validation.data,
        result_summary: `Task #${created.id} persisted in SQLite.`,
        duration_ms: 2,
      });
      const progress = calculateProgressMetrics(repo.listTasks());
      res.status(201).json({
        task: created,
        progress,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to create task.',
      });
    }
  };
  app.post(['/tasks', '/api/tasks'], handleCreateTask);

  // 4. Update Task Endpoint
  const handleUpdateTask = (req: Request, res: Response) => {
    const taskId = Number(req.params.task_id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      res.status(400).json({ error: 'Invalid numeric task_id parameter.' });
      return;
    }
    const validation = validateUpdateTaskInput(req.body);
    if (!validation.valid || !validation.data) {
      res.status(400).json({ error: validation.error || 'Invalid task update payload.' });
      return;
    }
    try {
      const updated = repo.updateTask(taskId, validation.data);
      if (!updated) {
        res.status(404).json({ error: `Task with ID #${taskId} not found.` });
        return;
      }
      const toolName = validation.data.status === 'completed' ? 'complete_task' : 'update_task';
      repo.logActivity({
        conversation_id: 'direct-ui',
        tool_name: toolName,
        action_description:
          toolName === 'complete_task'
            ? `Completed task #${updated.id}: "${updated.title}"`
            : `Updated task #${updated.id}: "${updated.title}" (${updated.status}, ${updated.priority} priority)`,
        status: 'success',
        arguments_summary: { task_id: taskId, ...validation.data },
        result_summary: `Task #${updated.id} updated in SQLite.`,
        duration_ms: 2,
      });
      const progress = calculateProgressMetrics(repo.listTasks());
      res.status(200).json({
        task: updated,
        progress,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to update task.',
      });
    }
  };
  app.patch(['/tasks/:task_id', '/api/tasks/:task_id'], handleUpdateTask);

  // 5. Delete Task Endpoint
  const handleDeleteTask = (req: Request, res: Response) => {
    const taskId = Number(req.params.task_id);
    if (!Number.isInteger(taskId) || taskId <= 0) {
      res.status(400).json({ error: 'Invalid numeric task_id parameter.' });
      return;
    }
    try {
      const existing = repo.getTaskById(taskId);
      if (!existing) {
        res.status(404).json({ error: `Task with ID #${taskId} not found.` });
        return;
      }
      const deleted = repo.deleteTask(taskId);
      repo.logActivity({
        conversation_id: 'direct-ui',
        tool_name: 'delete_task',
        action_description: `Deleted task #${taskId}: "${existing.title}" (${existing.subject})`,
        status: 'success',
        arguments_summary: { task_id: taskId, confirm: true },
        result_summary: `Task #${taskId} removed from SQLite.`,
        duration_ms: 2,
      });
      const progress = calculateProgressMetrics(repo.listTasks());
      res.status(200).json({
        deleted,
        task_id: taskId,
        progress,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to delete task.',
      });
    }
  };
  app.delete(['/tasks/:task_id', '/api/tasks/:task_id'], handleDeleteTask);

  // 6. Agent Chat Endpoint
  const handleChat = async (req: Request, res: Response) => {
    const validation = validateChatRequest(
      req.body,
      Number(process.env.MAX_TOOL_ITERATIONS) || 5
    );
    if (!validation.valid || !validation.data) {
      res.status(400).json({ error: validation.error || 'Invalid chat payload.' });
      return;
    }

    try {
      const adapter = createConfiguredModelAdapter(repo);
      const result = await runStudyPilotAgentTurn({
        repo,
        adapter,
        conversationId: validation.data.conversation_id,
        userMessage: validation.data.message,
        maxIterations: validation.data.max_iterations,
      });
      const progress = calculateProgressMetrics(result.tasks);
      res.status(200).json({
        ...result,
        progress,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent chat execution failed.';
      repo.logActivity({
        conversation_id: validation.data.conversation_id,
        tool_name: 'agent_turn_error',
        action_description: `Agent turn error: ${message}`,
        status: 'error',
        arguments_summary: { conversation_id: validation.data.conversation_id },
        result_summary: message,
        duration_ms: 0,
      });
      res.status(500).json({
        error: message,
      });
    }
  };
  app.post(['/chat', '/api/chat'], handleChat);

  // 7. Agent Activity Endpoint
  const handleActivity = (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const activity = repo.listActivity(limit);
      res.status(200).json({ activity });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to load agent activity.',
      });
    }
  };
  app.get(['/activity', '/api/activity'], handleActivity);

  // 8. Conversation History Endpoints
  app.get('/api/conversations/:conversation_id', (req: Request, res: Response) => {
    const cid = String(req.params.conversation_id || 'default-session').trim();
    const messages = repo.getConversationHistory(cid, 30);
    res.status(200).json({ conversation_id: cid, messages });
  });

  app.delete('/api/conversations/:conversation_id', (req: Request, res: Response) => {
    const cid = String(req.params.conversation_id || 'default-session').trim();
    repo.clearConversationHistory(cid);
    res.status(200).json({ cleared: true, conversation_id: cid });
  });

  // JSON parse error handler
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Malformed JSON in request body.' });
      return;
    }
    next(err);
  });

  return { app, repo };
}

async function startServer() {
  const { app } = createStudyPilotApp();
  const port = Number(process.env.PORT) || 3000;
  const distPath = path.resolve(process.cwd(), 'dist');

  if (process.env.NODE_ENV === 'production' && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`StudyPilot AI server listening on http://0.0.0.0:${port}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('Failed to start StudyPilot AI server:', err);
    process.exit(1);
  });
}
