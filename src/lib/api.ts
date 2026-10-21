import type {
  StudyTask,
  CreateTaskInput,
  UpdateTaskInput,
  AgentActivityRecord,
  ChatMessageRecord,
  ProgressMetrics,
} from './validation.ts';

export interface ToolExecutionOutcomeDTO {
  tool_name: string;
  status: 'success' | 'error';
  action_description: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  duration_ms: number;
}

export interface HealthStatusDTO {
  status: string;
  service: string;
  database: string;
  tasks_count: number;
  provider: string;
  model: string;
  max_tool_iterations: number;
  timestamp: string;
}

export interface ChatResponseDTO {
  reply: string;
  conversation_id: string;
  tool_executions: ToolExecutionOutcomeDTO[];
  iterations_used: number;
  max_iterations: number;
  provider: string;
  model: string;
  tasks: StudyTask[];
  progress: ProgressMetrics;
  activity: AgentActivityRecord[];
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    // non-json response
  }

  if (!response.ok) {
    const errMsg =
      typeof data.error === 'string'
        ? data.error
        : typeof data.detail === 'string'
          ? data.detail
          : `Request failed with HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  return data as T;
}

export const studyPilotApi = {
  getHealth(): Promise<HealthStatusDTO> {
    return requestJson<HealthStatusDTO>('/api/health');
  },

  listTasks(filters?: {
    status?: string;
    priority?: string;
    subject?: string;
    search?: string;
  }): Promise<{ tasks: StudyTask[]; progress: ProgressMetrics }> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.priority && filters.priority !== 'all') params.set('priority', filters.priority);
    if (filters?.subject && filters.subject !== 'all') params.set('subject', filters.subject);
    if (filters?.search && filters.search.trim() !== '') params.set('search', filters.search.trim());
    const qs = params.toString();
    return requestJson<{ tasks: StudyTask[]; progress: ProgressMetrics }>(
      `/api/tasks${qs ? `?${qs}` : ''}`
    );
  },

  createTask(input: CreateTaskInput): Promise<{ task: StudyTask; progress: ProgressMetrics }> {
    return requestJson<{ task: StudyTask; progress: ProgressMetrics }>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateTask(
    taskId: number,
    input: UpdateTaskInput
  ): Promise<{ task: StudyTask; progress: ProgressMetrics }> {
    return requestJson<{ task: StudyTask; progress: ProgressMetrics }>(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteTask(taskId: number): Promise<{ deleted: boolean; task_id: number; progress: ProgressMetrics }> {
    return requestJson<{ deleted: boolean; task_id: number; progress: ProgressMetrics }>(
      `/api/tasks/${taskId}`,
      {
        method: 'DELETE',
      }
    );
  },

  sendChatMessage(payload: {
    message: string;
    conversation_id: string;
    max_iterations?: number;
  }): Promise<ChatResponseDTO> {
    return requestJson<ChatResponseDTO>('/api/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  listActivity(limit = 50): Promise<{ activity: AgentActivityRecord[] }> {
    return requestJson<{ activity: AgentActivityRecord[] }>(`/api/activity?limit=${limit}`);
  },

  getConversationHistory(
    conversationId: string
  ): Promise<{ conversation_id: string; messages: ChatMessageRecord[] }> {
    return requestJson<{ conversation_id: string; messages: ChatMessageRecord[] }>(
      `/api/conversations/${encodeURIComponent(conversationId)}`
    );
  },

  clearConversationHistory(conversationId: string): Promise<{ cleared: boolean; conversation_id: string }> {
    return requestJson<{ cleared: boolean; conversation_id: string }>(
      `/api/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' }
    );
  },
};
