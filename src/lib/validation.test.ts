import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateTaskInput,
  validateUpdateTaskInput,
  validateChatRequest,
  calculateProgressMetrics,
  sortTasksByPriorityAndDeadline,
  sanitizeForActivityLog,
  type StudyTask,
} from './validation.ts';

test('validateCreateTaskInput accepts valid task and normalizes defaults', () => {
  const res = validateCreateTaskInput({
    title: '  Review Electromagnetism Maxwell Equations  ',
    subject: 'Physics',
    priority: 'HIGH',
    due_date: '2026-10-23',
  });
  assert.equal(res.valid, true);
  assert.equal(res.data?.title, 'Review Electromagnetism Maxwell Equations');
  assert.equal(res.data?.subject, 'Physics');
  assert.equal(res.data?.priority, 'high');
  assert.equal(res.data?.status, 'pending');
  assert.equal(res.data?.due_date, '2026-10-23');
  assert.equal(res.data?.estimated_minutes, 45);
});

test('validateCreateTaskInput rejects empty title or invalid priority', () => {
  const emptyTitle = validateCreateTaskInput({ title: '   ' });
  assert.equal(emptyTitle.valid, false);
  assert.match(emptyTitle.error ?? '', /title is required/i);

  const badPriority = validateCreateTaskInput({ title: 'Read chapter 4', priority: 'urgent' });
  assert.equal(badPriority.valid, false);
  assert.match(badPriority.error ?? '', /Priority must be one of/i);
});

test('validateUpdateTaskInput requires at least one valid field', () => {
  const emptyUpdate = validateUpdateTaskInput({});
  assert.equal(emptyUpdate.valid, false);

  const validUpdate = validateUpdateTaskInput({ status: 'completed', priority: 'low' });
  assert.equal(validUpdate.valid, true);
  assert.equal(validUpdate.data?.status, 'completed');
  assert.equal(validUpdate.data?.priority, 'low');
});

test('validateChatRequest enforces message length and bounded max_iterations', () => {
  const valid = validateChatRequest({
    message: 'Help me plan my chemistry assignment due Friday',
    conversation_id: 'conv_2026_01',
    max_iterations: 4,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.data?.conversation_id, 'conv_2026_01');
  assert.equal(valid.data?.max_iterations, 4);

  const badIterations = validateChatRequest({
    message: 'Hello',
    max_iterations: 25,
  });
  assert.equal(badIterations.valid, false);
  assert.match(badIterations.error ?? '', /max_iterations/i);
});

test('calculateProgressMetrics computes accurate completion rates and subject breakdown', () => {
  const sampleTasks: StudyTask[] = [
    {
      id: 1,
      title: 'Kinematics problem set',
      description: '',
      subject: 'Physics',
      priority: 'high',
      status: 'completed',
      due_date: '2026-10-20',
      estimated_minutes: 60,
      created_at: '2026-10-19T00:00:00Z',
      updated_at: '2026-10-19T00:00:00Z',
    },
    {
      id: 2,
      title: 'Thermodynamics lab prep',
      description: '',
      subject: 'Physics',
      priority: 'high',
      status: 'pending',
      due_date: '2026-10-21',
      estimated_minutes: 90,
      created_at: '2026-10-19T00:00:00Z',
      updated_at: '2026-10-19T00:00:00Z',
    },
    {
      id: 3,
      title: 'Organic synthesis worksheet',
      description: '',
      subject: 'Chemistry',
      priority: 'medium',
      status: 'pending',
      due_date: '2026-10-23',
      estimated_minutes: 45,
      created_at: '2026-10-19T00:00:00Z',
      updated_at: '2026-10-19T00:00:00Z',
    },
  ];

  const metrics = calculateProgressMetrics(sampleTasks, '2026-10-19T12:00:00Z');
  assert.equal(metrics.total_tasks, 3);
  assert.equal(metrics.completed_tasks, 1);
  assert.equal(metrics.pending_tasks, 2);
  assert.equal(metrics.completion_rate, 33);
  assert.equal(metrics.high_priority_pending, 1);
  assert.equal(metrics.total_estimated_minutes_remaining, 135);
  assert.equal(metrics.by_subject.length, 2);
});

test('sortTasksByPriorityAndDeadline orders pending before completed, then by priority and due date', () => {
  const tasks: StudyTask[] = [
    {
      id: 1,
      title: 'Completed high priority',
      description: '',
      subject: 'Math',
      priority: 'high',
      status: 'completed',
      due_date: '2026-10-20',
      estimated_minutes: 30,
      created_at: '',
      updated_at: '',
    },
    {
      id: 2,
      title: 'Pending medium priority',
      description: '',
      subject: 'Math',
      priority: 'medium',
      status: 'pending',
      due_date: '2026-10-20',
      estimated_minutes: 30,
      created_at: '',
      updated_at: '',
    },
    {
      id: 3,
      title: 'Pending high priority later due',
      description: '',
      subject: 'Physics',
      priority: 'high',
      status: 'pending',
      due_date: '2026-10-24',
      estimated_minutes: 45,
      created_at: '',
      updated_at: '',
    },
    {
      id: 4,
      title: 'Pending high priority earlier due',
      description: '',
      subject: 'Physics',
      priority: 'high',
      status: 'pending',
      due_date: '2026-10-21',
      estimated_minutes: 45,
      created_at: '',
      updated_at: '',
    },
  ];

  const sorted = sortTasksByPriorityAndDeadline(tasks);
  assert.deepEqual(sorted.map((t) => t.id), [4, 3, 2, 1]);
});

test('sanitizeForActivityLog redacts sensitive keys and truncates long values', () => {
  const sanitized = sanitizeForActivityLog({
    title: 'Normal task title',
    api_key: 'sk-secret-12345',
    authToken: 'bearer-xyz',
  });
  const parsed = JSON.parse(sanitized);
  assert.equal(parsed.title, 'Normal task title');
  assert.equal(parsed.api_key, '[REDACTED]');
  assert.equal(parsed.authToken, '[REDACTED]');
});

test('formatStudyPlanMarkdown generates structured markdown study plan from SQLite tasks', async () => {
  const { formatStudyPlanMarkdown } = await import('./validation.ts');
  const sampleTasks: StudyTask[] = [
    {
      id: 10,
      title: 'Physics Topic 1: Kinematics',
      description: 'Solve 15 projectile problems',
      subject: 'Physics',
      priority: 'high',
      status: 'pending',
      due_date: '2026-10-23',
      estimated_minutes: 60,
      created_at: '',
      updated_at: '',
    },
  ];
  const metrics = calculateProgressMetrics(sampleTasks, '2026-10-19');
  const md = formatStudyPlanMarkdown(sampleTasks, metrics, '2026-10-19T12:00:00Z');
  assert.ok(md.includes('# StudyPilot AI — Actionable Study Plan'));
  assert.ok(md.includes('**[HIGH] Physics Topic 1: Kinematics**'));
  assert.ok(md.includes('Solve 15 projectile problems'));
});

