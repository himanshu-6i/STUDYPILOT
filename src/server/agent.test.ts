import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { StudyPilotRepository } from './database.ts';
import {
  executeValidatedAgentTool,
  runStudyPilotAgentTurn,
  StructuredStudyAgentFallbackAdapter,
  type ModelProviderAdapter,
} from './agent.ts';

function createTempRepo(): { repo: StudyPilotRepository; cleanup: () => void } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'studypilot-test-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const repo = new StudyPilotRepository(dbPath);
  return {
    repo,
    cleanup: () => {
      try {
        repo.close();
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    },
  };
}

test('SQLite repository persists tasks, updates completion, and handles invalid IDs', () => {
  const { repo, cleanup } = createTempRepo();
  try {
    const created = repo.createTask({
      title: 'Derive Schrödinger Wave Equation',
      subject: 'Physics',
      priority: 'high',
      due_date: '2026-10-23',
      estimated_minutes: 90,
    });
    assert.equal(created.id, 1);
    assert.equal(created.status, 'pending');

    const listed = repo.listTasks();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].title, 'Derive Schrödinger Wave Equation');

    const updated = repo.updateTask(created.id, { status: 'completed', priority: 'medium' });
    assert.ok(updated);
    assert.equal(updated.status, 'completed');
    assert.equal(updated.priority, 'medium');

    const nonExistentUpdate = repo.updateTask(9999, { status: 'completed' });
    assert.equal(nonExistentUpdate, null);

    const nonExistentDelete = repo.deleteTask(9999);
    assert.equal(nonExistentDelete, false);

    const validDelete = repo.deleteTask(created.id);
    assert.equal(validDelete, true);
    assert.equal(repo.listTasks().length, 0);
  } finally {
    cleanup();
  }
});

test('executeValidatedAgentTool validates inputs, deduplicates pending tasks, and enforces delete confirmation', () => {
  const { repo, cleanup } = createTempRepo();
  try {
    // 1. Create valid task
    const res1 = executeValidatedAgentTool(repo, 'test-conv', {
      name: 'create_task',
      args: {
        title: 'Organic Chemistry Mechanisms',
        subject: 'Chemistry',
        priority: 'high',
        due_date: '2026-10-23',
      },
    });
    assert.equal(res1.status, 'success');
    assert.equal(res1.result.ok, true);

    // 2. Duplicate pending task is prevented
    const resDup = executeValidatedAgentTool(repo, 'test-conv', {
      name: 'create_task',
      args: {
        title: 'Organic Chemistry Mechanisms',
        subject: 'Chemistry',
        priority: 'high',
      },
    });
    assert.equal(resDup.status, 'success');
    assert.equal(resDup.result.deduplicated, true);
    assert.equal(repo.listTasks().length, 1);

    // 3. Delete without confirm=true is rejected
    const resUnconfirmedDelete = executeValidatedAgentTool(repo, 'test-conv', {
      name: 'delete_task',
      args: {
        task_id: 1,
        confirm: false,
      },
    });
    assert.equal(resUnconfirmedDelete.status, 'error');
    assert.equal(resUnconfirmedDelete.result.requires_clarification, true);
    assert.equal(repo.listTasks().length, 1);

    // 4. Complete task works and logs activity
    const resComplete = executeValidatedAgentTool(repo, 'test-conv', {
      name: 'complete_task',
      args: { task_id: 1 },
    });
    assert.equal(resComplete.status, 'success');
    assert.equal(repo.getTaskById(1)?.status, 'completed');

    // 5. Unknown tool is blocked
    const resUnknown = executeValidatedAgentTool(repo, 'test-conv', {
      name: 'execute_shell_command',
      args: { cmd: 'rm -rf /' },
    });
    assert.equal(resUnknown.status, 'error');

    const activity = repo.listActivity();
    assert.equal(activity.length, 5);
  } finally {
    cleanup();
  }
});

test('Multi-step study planning request creates persisted tasks and records activity', async () => {
  const { repo, cleanup } = createTempRepo();
  try {
    const adapter = new StructuredStudyAgentFallbackAdapter(repo);
    const turn = await runStudyPilotAgentTurn({
      repo,
      adapter,
      conversationId: 'hackathon-demo-session',
      userMessage:
        'I have three physics topics and one chemistry assignment to finish by Friday. Create a realistic study plan, prioritize everything, and help me track my progress.',
      maxIterations: 5,
    });

    assert.ok(turn.tool_executions.length >= 4);
    const persistedTasks = repo.listTasks();
    assert.equal(persistedTasks.length, 4);
    const subjects = new Set(persistedTasks.map((t) => t.subject));
    assert.equal(subjects.has('Physics'), true);
    assert.equal(subjects.has('Chemistry'), true);
    assert.match(turn.reply, /actionable study task/i);
  } finally {
    cleanup();
  }
});

test('Bounded tool loop stops strictly at maxIterations when model keeps requesting tools', async () => {
  const { repo, cleanup } = createTempRepo();
  try {
    let callCount = 0;
    const runawayMockAdapter: ModelProviderAdapter = {
      providerName: 'mock-runaway',
      modelName: 'mock-v1',
      async generateTurn() {
        callCount += 1;
        return {
          providerName: 'mock-runaway',
          modelName: 'mock-v1',
          toolCalls: [
            {
              name: 'retrieve_progress',
              args: { include_subject_breakdown: true },
            },
          ],
        };
      },
    };

    const result = await runStudyPilotAgentTurn({
      repo,
      adapter: runawayMockAdapter,
      conversationId: 'bounded-loop-test',
      userMessage: 'Check my progress repeatedly',
      maxIterations: 3,
    });

    assert.equal(callCount, 3);
    assert.equal(result.iterations_used, 3);
    assert.equal(result.tool_executions.length, 3);
  } finally {
    cleanup();
  }
});
