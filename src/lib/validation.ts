export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'completed';

export interface StudyTask {
  id: number;
  title: string;
  description: string;
  subject: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  estimated_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  subject?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  estimated_minutes?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  subject?: string;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  estimated_minutes?: number;
}

export interface AgentActivityRecord {
  id: number;
  conversation_id: string;
  tool_name: string;
  action_description: string;
  status: 'success' | 'error';
  arguments_summary: string;
  result_summary: string;
  duration_ms: number;
  created_at: string;
}

export interface ChatMessageRecord {
  id: number;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls_json: string;
  created_at: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  error?: string;
}

const VALID_PRIORITIES: ReadonlySet<string> = new Set(['low', 'medium', 'high']);
const VALID_STATUSES: ReadonlySet<string> = new Set(['pending', 'completed']);

export function normalizeDateString(input: unknown): ValidationResult<string | null> {
  if (input === undefined || input === null || input === '') {
    return { valid: true, data: null };
  }
  if (typeof input !== 'string') {
    return { valid: false, error: 'Due date must be a string in YYYY-MM-DD format.' };
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: true, data: null };
  }
  // Accept YYYY-MM-DD or full ISO strings
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return { valid: false, error: 'Due date contains out-of-range calendar values.' };
    }
    return { valid: true, data: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` };
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, error: 'Invalid due_date format. Expected YYYY-MM-DD.' };
  }
  return { valid: true, data: parsed.toISOString().slice(0, 10) };
}

export function validateCreateTaskInput(raw: unknown): ValidationResult<Required<CreateTaskInput>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Request payload must be a JSON object.' };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    return { valid: false, error: 'Task title is required and cannot be empty.' };
  }
  const title = obj.title.trim();
  if (title.length > 200) {
    return { valid: false, error: 'Task title cannot exceed 200 characters.' };
  }

  let description = '';
  if (obj.description !== undefined && obj.description !== null) {
    if (typeof obj.description !== 'string') {
      return { valid: false, error: 'Task description must be a string.' };
    }
    description = obj.description.trim();
    if (description.length > 2000) {
      return { valid: false, error: 'Task description cannot exceed 2000 characters.' };
    }
  }

  let subject = 'General';
  if (obj.subject !== undefined && obj.subject !== null && String(obj.subject).trim() !== '') {
    if (typeof obj.subject !== 'string') {
      return { valid: false, error: 'Subject must be a string.' };
    }
    subject = obj.subject.trim();
    if (subject.length > 80) {
      return { valid: false, error: 'Subject cannot exceed 80 characters.' };
    }
  }

  let priority: TaskPriority = 'medium';
  if (obj.priority !== undefined && obj.priority !== null && obj.priority !== '') {
    const p = String(obj.priority).toLowerCase().trim();
    if (!VALID_PRIORITIES.has(p)) {
      return { valid: false, error: 'Priority must be one of: low, medium, high.' };
    }
    priority = p as TaskPriority;
  }

  let status: TaskStatus = 'pending';
  if (obj.status !== undefined && obj.status !== null && obj.status !== '') {
    const s = String(obj.status).toLowerCase().trim();
    if (!VALID_STATUSES.has(s)) {
      return { valid: false, error: 'Status must be one of: pending, completed.' };
    }
    status = s as TaskStatus;
  }

  const dueRes = normalizeDateString(obj.due_date);
  if (!dueRes.valid) {
    return { valid: false, error: dueRes.error };
  }

  let estimated_minutes = 45;
  if (obj.estimated_minutes !== undefined && obj.estimated_minutes !== null && obj.estimated_minutes !== '') {
    const mins = Number(obj.estimated_minutes);
    if (!Number.isFinite(mins) || mins < 5 || mins > 600) {
      return { valid: false, error: 'Estimated minutes must be a number between 5 and 600.' };
    }
    estimated_minutes = Math.round(mins);
  }

  return {
    valid: true,
    data: {
      title,
      description,
      subject,
      priority,
      status,
      due_date: dueRes.data ?? null,
      estimated_minutes,
    },
  };
}

export function validateUpdateTaskInput(raw: unknown): ValidationResult<UpdateTaskInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Update payload must be a JSON object.' };
  }
  const obj = raw as Record<string, unknown>;
  const updates: UpdateTaskInput = {};
  let hasField = false;

  if (obj.title !== undefined) {
    if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
      return { valid: false, error: 'Task title cannot be empty.' };
    }
    if (obj.title.trim().length > 200) {
      return { valid: false, error: 'Task title cannot exceed 200 characters.' };
    }
    updates.title = obj.title.trim();
    hasField = true;
  }

  if (obj.description !== undefined) {
    if (obj.description === null) {
      updates.description = '';
    } else if (typeof obj.description === 'string') {
      if (obj.description.trim().length > 2000) {
        return { valid: false, error: 'Task description cannot exceed 2000 characters.' };
      }
      updates.description = obj.description.trim();
    } else {
      return { valid: false, error: 'Task description must be a string.' };
    }
    hasField = true;
  }

  if (obj.subject !== undefined) {
    if (typeof obj.subject !== 'string' || obj.subject.trim().length === 0) {
      return { valid: false, error: 'Subject must be a non-empty string.' };
    }
    if (obj.subject.trim().length > 80) {
      return { valid: false, error: 'Subject cannot exceed 80 characters.' };
    }
    updates.subject = obj.subject.trim();
    hasField = true;
  }

  if (obj.priority !== undefined) {
    const p = String(obj.priority).toLowerCase().trim();
    if (!VALID_PRIORITIES.has(p)) {
      return { valid: false, error: 'Priority must be one of: low, medium, high.' };
    }
    updates.priority = p as TaskPriority;
    hasField = true;
  }

  if (obj.status !== undefined) {
    const s = String(obj.status).toLowerCase().trim();
    if (!VALID_STATUSES.has(s)) {
      return { valid: false, error: 'Status must be one of: pending, completed.' };
    }
    updates.status = s as TaskStatus;
    hasField = true;
  }

  if (obj.due_date !== undefined) {
    const dueRes = normalizeDateString(obj.due_date);
    if (!dueRes.valid) {
      return { valid: false, error: dueRes.error };
    }
    updates.due_date = dueRes.data ?? null;
    hasField = true;
  }

  if (obj.estimated_minutes !== undefined) {
    const mins = Number(obj.estimated_minutes);
    if (!Number.isFinite(mins) || mins < 5 || mins > 600) {
      return { valid: false, error: 'Estimated minutes must be between 5 and 600.' };
    }
    updates.estimated_minutes = Math.round(mins);
    hasField = true;
  }

  if (!hasField) {
    return { valid: false, error: 'At least one valid field must be provided for update.' };
  }

  return { valid: true, data: updates };
}

export interface ValidatedChatRequest {
  message: string;
  conversation_id: string;
  max_iterations: number;
}

export function validateChatRequest(raw: unknown, defaultMaxIterations = 5): ValidationResult<ValidatedChatRequest> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Chat request must be a JSON object.' };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
    return { valid: false, error: 'Message is required and cannot be empty.' };
  }
  const message = obj.message.trim();
  if (message.length > 4000) {
    return { valid: false, error: 'Message cannot exceed 4000 characters.' };
  }

  let conversation_id = 'default-session';
  if (obj.conversation_id !== undefined && obj.conversation_id !== null && String(obj.conversation_id).trim() !== '') {
    const rawConv = String(obj.conversation_id).trim();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(rawConv)) {
      return { valid: false, error: 'conversation_id must be 1-80 alphanumeric, dash, or underscore characters.' };
    }
    conversation_id = rawConv;
  }

  let max_iterations = defaultMaxIterations;
  if (obj.max_iterations !== undefined && obj.max_iterations !== null) {
    const parsed = Number(obj.max_iterations);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8) {
      return { valid: false, error: 'max_iterations must be an integer between 1 and 8.' };
    }
    max_iterations = parsed;
  }

  return {
    valid: true,
    data: {
      message,
      conversation_id,
      max_iterations,
    },
  };
}

export interface ProgressMetrics {
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  completion_rate: number;
  high_priority_pending: number;
  overdue_or_due_soon: number;
  total_estimated_minutes_remaining: number;
  by_subject: Array<{
    subject: string;
    total: number;
    completed: number;
    pending: number;
    completion_rate: number;
    estimated_minutes_remaining: number;
  }>;
}

export function calculateProgressMetrics(tasks: StudyTask[], referenceDateIso?: string): ProgressMetrics {
  const total_tasks = tasks.length;
  const completed_tasks = tasks.filter((t) => t.status === 'completed').length;
  const pending_tasks = total_tasks - completed_tasks;
  const completion_rate = total_tasks === 0 ? 0 : Math.round((completed_tasks / total_tasks) * 100);
  const high_priority_pending = tasks.filter((t) => t.status === 'pending' && t.priority === 'high').length;

  const refDate = referenceDateIso ? new Date(referenceDateIso) : new Date();
  const threeDaysFromNow = new Date(refDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const overdue_or_due_soon = tasks.filter((t) => {
    if (t.status === 'completed' || !t.due_date) return false;
    return t.due_date <= threeDaysFromNow;
  }).length;

  const total_estimated_minutes_remaining = tasks
    .filter((t) => t.status === 'pending')
    .reduce((acc, t) => acc + (t.estimated_minutes || 45), 0);

  const subjectMap = new Map<
    string,
    { total: number; completed: number; pending: number; estimated_minutes_remaining: number }
  >();

  for (const task of tasks) {
    const subj = task.subject || 'General';
    const current = subjectMap.get(subj) ?? {
      total: 0,
      completed: 0,
      pending: 0,
      estimated_minutes_remaining: 0,
    };
    current.total += 1;
    if (task.status === 'completed') {
      current.completed += 1;
    } else {
      current.pending += 1;
      current.estimated_minutes_remaining += task.estimated_minutes || 45;
    }
    subjectMap.set(subj, current);
  }

  const by_subject = Array.from(subjectMap.entries())
    .map(([subject, stats]) => ({
      subject,
      ...stats,
      completion_rate: stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100),
    }))
    .sort((a, b) => b.pending - a.pending || a.subject.localeCompare(b.subject));

  return {
    total_tasks,
    completed_tasks,
    pending_tasks,
    completion_rate,
    high_priority_pending,
    overdue_or_due_soon,
    total_estimated_minutes_remaining,
    by_subject,
  };
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function sortTasksByPriorityAndDeadline(tasks: StudyTask[]): StudyTask[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'pending' ? -1 : 1;
    }
    const pDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (pDiff !== 0) return pDiff;
    if (a.due_date && b.due_date) {
      const cmp = a.due_date.localeCompare(b.due_date);
      if (cmp !== 0) return cmp;
    } else if (a.due_date && !b.due_date) {
      return -1;
    } else if (!a.due_date && b.due_date) {
      return 1;
    }
    return b.id - a.id;
  });
}

export function redactSecretPatterns(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z\-_]{16,}/g, '[REDACTED_GEMINI_KEY]')
    .replace(/sk-[0-9A-Za-z\-_]{16,}/g, '[REDACTED_OPENAI_KEY]')
    .replace(/Bearer\s+[0-9A-Za-z\-._~+/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
}

export function sanitizeForActivityLog(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return redactSecretPatterns(String(payload ?? ''));
  }
  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
    if (/key|token|secret|password|authorization|credential/i.test(key)) {
      clone[key] = '[REDACTED]';
    } else if (typeof val === 'string') {
      const scrubbed = redactSecretPatterns(val);
      clone[key] = scrubbed.length > 160 ? `${scrubbed.slice(0, 157)}...` : scrubbed;
    } else {
      clone[key] = val;
    }
  }
  return JSON.stringify(clone);
}

export function formatStudyPlanMarkdown(
  tasks: StudyTask[],
  progress: ProgressMetrics,
  generatedAtIso?: string
): string {
  const dateLabel = (generatedAtIso || new Date().toISOString()).slice(0, 10);
  const sorted = sortTasksByPriorityAndDeadline(tasks);

  const lines: string[] = [
    '# StudyPilot AI — Actionable Study Plan',
    `> **Alexa+ Simulated Experience** | Exported: ${dateLabel}`,
    '',
    '## Progress Summary',
    `- **Total Tasks**: ${progress.total_tasks}`,
    `- **Completed**: ${progress.completed_tasks} (${progress.completion_rate}%)`,
    `- **Pending**: ${progress.pending_tasks} (${progress.total_estimated_minutes_remaining} mins remaining)`,
    `- **High Priority Pending**: ${progress.high_priority_pending}`,
    '',
    '## Prioritized Study Queue',
  ];

  if (sorted.length === 0) {
    lines.push('_No tasks currently saved in SQLite._');
  } else {
    for (const t of sorted) {
      const check = t.status === 'completed' ? '[x]' : '[ ]';
      const due = t.due_date ? `Due: ${t.due_date}` : 'Due: Flexible';
      lines.push(
        `- ${check} **[${t.priority.toUpperCase()}] ${t.title}** (${t.subject} · ${due} · ${t.estimated_minutes}m)`
      );
      if (t.description) {
        lines.push(`  - _Notes_: ${t.description}`);
      }
    }
  }

  return lines.join('\n');
}

