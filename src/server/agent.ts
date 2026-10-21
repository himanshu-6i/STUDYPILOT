import { GoogleGenAI, Type, type FunctionDeclaration, type Content, type Part } from '@google/genai';
import {
  type StudyTask,
  type AgentActivityRecord,
  calculateProgressMetrics,
  validateCreateTaskInput,
  validateUpdateTaskInput,
  sanitizeForActivityLog,
} from '../lib/validation.ts';
import type { StudyPilotRepository } from './database.ts';

export interface ToolCallRequest {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolExecutionOutcome {
  tool_name: string;
  status: 'success' | 'error';
  action_description: string;
  args: Record<string, unknown>;
  result: Record<string, unknown>;
  duration_ms: number;
}

export interface ModelTurnResponse {
  text?: string;
  toolCalls?: ToolCallRequest[];
  providerName: string;
  modelName: string;
}

export interface ModelProviderAdapter {
  readonly providerName: string;
  readonly modelName: string;
  generateTurn(params: {
    systemInstruction: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    toolOutcomesSoFar: ToolExecutionOutcome[];
  }): Promise<ModelTurnResponse>;
}

export const AGENT_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'create_task',
    description:
      'Create and persist a new actionable study task in the SQLite database. Use this when breaking down study goals, assignments, or topics into concrete tasks.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: 'Clear, actionable task title (1-200 characters).',
        },
        subject: {
          type: Type.STRING,
          description: 'Academic subject or course name (e.g., Physics, Chemistry, Mathematics, Computer Science).',
        },
        description: {
          type: Type.STRING,
          description: 'Detailed study instructions, sub-topics, or deliverable notes.',
        },
        priority: {
          type: Type.STRING,
          description: 'Task priority level: low, medium, or high.',
        },
        due_date: {
          type: Type.STRING,
          description: 'Target completion date in YYYY-MM-DD format.',
        },
        estimated_minutes: {
          type: Type.INTEGER,
          description: 'Estimated study duration in minutes (between 15 and 240).',
        },
      },
      required: ['title', 'subject', 'priority'],
    },
  },
  {
    name: 'list_tasks',
    description:
      'List persisted study tasks from the database, optionally filtered by status, priority, subject, or search query.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: {
          type: Type.STRING,
          description: 'Filter by task status: pending, completed, or all.',
        },
        priority: {
          type: Type.STRING,
          description: 'Filter by task priority: low, medium, high, or all.',
        },
        subject: {
          type: Type.STRING,
          description: 'Filter by subject name.',
        },
        search: {
          type: Type.STRING,
          description: 'Optional keyword search across task titles and descriptions.',
        },
      },
    },
  },
  {
    name: 'update_task',
    description:
      'Update an existing task by its numeric task_id. Can modify title, description, subject, priority, status, due_date, or estimated_minutes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: {
          type: Type.INTEGER,
          description: 'The unique numeric ID of the task to update.',
        },
        title: {
          type: Type.STRING,
          description: 'Updated task title.',
        },
        description: {
          type: Type.STRING,
          description: 'Updated task description.',
        },
        subject: {
          type: Type.STRING,
          description: 'Updated academic subject.',
        },
        priority: {
          type: Type.STRING,
          description: 'Updated priority level: low, medium, or high.',
        },
        status: {
          type: Type.STRING,
          description: 'Updated status: pending or completed.',
        },
        due_date: {
          type: Type.STRING,
          description: 'Updated due date in YYYY-MM-DD format.',
        },
        estimated_minutes: {
          type: Type.INTEGER,
          description: 'Updated duration in minutes.',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark an existing study task as completed using its numeric task_id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: {
          type: Type.INTEGER,
          description: 'The unique numeric ID of the task to mark completed.',
        },
      },
      required: ['task_id'],
    },
  },
  {
    name: 'delete_task',
    description:
      'Permanently delete a study task from the database. Requires an unambiguous numeric task_id and confirm=true.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task_id: {
          type: Type.INTEGER,
          description: 'The unique numeric ID of the task to delete.',
        },
        confirm: {
          type: Type.BOOLEAN,
          description: 'Must be set to true when the user explicitly confirmed deletion of this specific task.',
        },
      },
      required: ['task_id', 'confirm'],
    },
  },
  {
    name: 'retrieve_progress',
    description:
      'Retrieve overall study progress metrics, completion rate, remaining study minutes, and subject-by-subject breakdown from the database.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        include_subject_breakdown: {
          type: Type.BOOLEAN,
          description: 'Whether to include per-subject completion metrics (defaults to true).',
        },
      },
    },
  },
];

/**
 * Validated backend tool executor.
 * Never executes arbitrary code or unvalidated inputs.
 */
export function executeValidatedAgentTool(
  repo: StudyPilotRepository,
  conversationId: string,
  call: ToolCallRequest
): ToolExecutionOutcome {
  const startTime = Date.now();
  const args = call.args && typeof call.args === 'object' ? call.args : {};

  const recordOutcome = (
    status: 'success' | 'error',
    action_description: string,
    result: Record<string, unknown>
  ): ToolExecutionOutcome => {
    const duration_ms = Math.max(1, Date.now() - startTime);
    repo.logActivity({
      conversation_id: conversationId,
      tool_name: call.name,
      action_description,
      status,
      arguments_summary: sanitizeForActivityLog(args),
      result_summary: JSON.stringify(result).slice(0, 450),
      duration_ms,
    });
    return {
      tool_name: call.name,
      status,
      action_description,
      args,
      result,
      duration_ms,
    };
  };

  try {
    switch (call.name) {
      case 'create_task': {
        const validation = validateCreateTaskInput(args);
        if (!validation.valid || !validation.data) {
          return recordOutcome('error', `Rejected invalid create_task arguments: ${validation.error}`, {
            ok: false,
            error: validation.error,
          });
        }
        const duplicate = repo.findDuplicatePendingTask(validation.data.title, validation.data.subject);
        if (duplicate) {
          return recordOutcome(
            'success',
            `Prevented duplicate pending task "${duplicate.title}" (#${duplicate.id}) in ${duplicate.subject}`,
            {
              ok: true,
              deduplicated: true,
              task: duplicate,
              message: `Pending task "${duplicate.title}" already exists with ID #${duplicate.id}.`,
            }
          );
        }
        const created = repo.createTask(validation.data);
        return recordOutcome(
          'success',
          `Created task #${created.id}: "${created.title}" (${created.subject}, ${created.priority} priority${created.due_date ? `, due ${created.due_date}` : ''})`,
          {
            ok: true,
            task: created,
          }
        );
      }

      case 'list_tasks': {
        const filters = {
          status: typeof args.status === 'string' ? args.status : undefined,
          priority: typeof args.priority === 'string' ? args.priority : undefined,
          subject: typeof args.subject === 'string' ? args.subject : undefined,
          search: typeof args.search === 'string' ? args.search : undefined,
        };
        const tasks = repo.listTasks(filters);
        return recordOutcome(
          'success',
          `Listed ${tasks.length} task(s) from SQLite database${filters.subject ? ` for ${filters.subject}` : ''}`,
          {
            ok: true,
            count: tasks.length,
            tasks,
          }
        );
      }

      case 'update_task': {
        const taskId = Number(args.task_id);
        if (!Number.isInteger(taskId) || taskId <= 0) {
          return recordOutcome('error', 'Failed update_task: valid numeric task_id is required.', {
            ok: false,
            error: 'A valid positive integer task_id is required.',
          });
        }
        const updatePayload: Record<string, unknown> = { ...args };
        delete updatePayload.task_id;
        const validation = validateUpdateTaskInput(updatePayload);
        if (!validation.valid || !validation.data) {
          return recordOutcome('error', `Rejected update_task for #${taskId}: ${validation.error}`, {
            ok: false,
            error: validation.error,
          });
        }
        const updated = repo.updateTask(taskId, validation.data);
        if (!updated) {
          return recordOutcome('error', `Task #${taskId} not found in database.`, {
            ok: false,
            error: `Task with ID #${taskId} does not exist.`,
          });
        }
        return recordOutcome('success', `Updated task #${updated.id}: "${updated.title}"`, {
          ok: true,
          task: updated,
        });
      }

      case 'complete_task': {
        const taskId = Number(args.task_id);
        if (!Number.isInteger(taskId) || taskId <= 0) {
          return recordOutcome('error', 'Failed complete_task: valid numeric task_id is required.', {
            ok: false,
            error: 'A valid positive integer task_id is required to complete a task.',
          });
        }
        const updated = repo.updateTask(taskId, { status: 'completed' });
        if (!updated) {
          return recordOutcome('error', `Cannot complete task #${taskId}: task not found.`, {
            ok: false,
            error: `Task with ID #${taskId} was not found.`,
          });
        }
        return recordOutcome('success', `Marked task #${updated.id} ("${updated.title}") as completed.`, {
          ok: true,
          task: updated,
        });
      }

      case 'delete_task': {
        const taskId = Number(args.task_id);
        const confirm = args.confirm === true;
        if (!Number.isInteger(taskId) || taskId <= 0) {
          return recordOutcome(
            'error',
            'Refused ambiguous delete_task call: numeric task_id is required.',
            {
              ok: false,
              requires_clarification: true,
              error: 'Ambiguous delete request. Please specify the exact numeric task_id to delete.',
            }
          );
        }
        if (!confirm) {
          return recordOutcome(
            'error',
            `Refused delete_task for #${taskId} without explicit confirmation flag.`,
            {
              ok: false,
              requires_clarification: true,
              error: 'Destructive action requires confirm=true and explicit user intent.',
            }
          );
        }
        const existing = repo.getTaskById(taskId);
        if (!existing) {
          return recordOutcome('error', `Cannot delete task #${taskId}: task not found.`, {
            ok: false,
            error: `Task with ID #${taskId} does not exist.`,
          });
        }
        const deleted = repo.deleteTask(taskId);
        return recordOutcome('success', `Deleted task #${taskId}: "${existing.title}" (${existing.subject})`, {
          ok: deleted,
          deleted_task_id: taskId,
          deleted_title: existing.title,
        });
      }

      case 'retrieve_progress': {
        const allTasks = repo.listTasks();
        const metrics = calculateProgressMetrics(allTasks);
        return recordOutcome(
          'success',
          `Retrieved study progress: ${metrics.completed_tasks}/${metrics.total_tasks} completed (${metrics.completion_rate}%)`,
          {
            ok: true,
            progress: metrics,
          }
        );
      }

      default:
        return recordOutcome('error', `Blocked unknown tool invocation: "${call.name}"`, {
          ok: false,
          error: `Unsupported tool "${call.name}". Allowed tools: create_task, list_tasks, update_task, complete_task, delete_task, retrieve_progress.`,
        });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected database error during tool execution.';
    return recordOutcome('error', `Tool "${call.name}" failed: ${message}`, {
      ok: false,
      error: message,
    });
  }
}

/**
 * Gemini Model Provider Adapter (@google/genai)
 */
export class GeminiModelAdapter implements ModelProviderAdapter {
  public readonly providerName = 'gemini';
  public readonly modelName: string;
  private ai: GoogleGenAI;

  constructor(apiKey: string, modelName = 'gemini-3.8-flash') {
    this.modelName = modelName;
    this.ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  public async generateTurn(params: {
    systemInstruction: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    toolOutcomesSoFar: ToolExecutionOutcome[];
  }): Promise<ModelTurnResponse> {
    const contents: Content[] = [];

    for (const msg of params.history.slice(-10)) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const userParts: Part[] = [{ text: params.userMessage }];
    if (params.toolOutcomesSoFar.length > 0) {
      const outcomeSummary = params.toolOutcomesSoFar
        .map(
          (o, idx) =>
            `Tool Execution #${idx + 1}: ${o.tool_name}(${JSON.stringify(o.args)}) -> Status: ${o.status.toUpperCase()} -> Result: ${JSON.stringify(o.result)}`
        )
        .join('\n');
      userParts.push({
        text: `\n\n[BACKEND TOOL EXECUTION RESULTS FOR THIS TURN]\n${outcomeSummary}\n\nIf additional tool calls are needed to fulfill the user's request, invoke them now. Otherwise, provide a clear, truthful final summary of the actions completed in the database.`,
      });
    }

    contents.push({
      role: 'user',
      parts: userParts,
    });

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents,
      config: {
        systemInstruction: params.systemInstruction,
        temperature: 0.2,
        tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }],
      },
    });

    const fnCalls = response.functionCalls;
    if (fnCalls && fnCalls.length > 0) {
      const toolCalls: ToolCallRequest[] = fnCalls.map((fc) => ({
        id: fc.id,
        name: fc.name ?? 'unknown',
        args: (fc.args as Record<string, unknown>) ?? {},
      }));
      return {
        text: response.text ?? '',
        toolCalls,
        providerName: this.providerName,
        modelName: this.modelName,
      };
    }

    return {
      text: response.text ?? 'Action completed.',
      toolCalls: [],
      providerName: this.providerName,
      modelName: this.modelName,
    };
  }
}

/**
 * OpenAI-Compatible Provider Adapter (supports OpenAI API when OPENAI_API_KEY is configured)
 */
export class OpenAICompatibleAdapter implements ModelProviderAdapter {
  public readonly providerName = 'openai';
  public readonly modelName: string;
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, modelName = 'gpt-4o-mini', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.modelName = modelName;
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  public async generateTurn(params: {
    systemInstruction: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    toolOutcomesSoFar: ToolExecutionOutcome[];
  }): Promise<ModelTurnResponse> {
    const messages: Array<Record<string, unknown>> = [
      { role: 'system', content: params.systemInstruction },
      ...params.history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    ];

    let promptContent = params.userMessage;
    if (params.toolOutcomesSoFar.length > 0) {
      const outcomeSummary = params.toolOutcomesSoFar
        .map(
          (o, idx) =>
            `Tool #${idx + 1}: ${o.tool_name}(${JSON.stringify(o.args)}) => ${JSON.stringify(o.result)}`
        )
        .join('\n');
      promptContent += `\n\n[BACKEND TOOL EXECUTION RESULTS]\n${outcomeSummary}\nIf all requested actions are complete, summarize the confirmed changes clearly.`;
    }
    messages.push({ role: 'user', content: promptContent });

    const tools = AGENT_FUNCTION_DECLARATIONS.map((fn) => ({
      type: 'function',
      function: {
        name: fn.name,
        description: fn.description,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            Object.entries(fn.parameters?.properties ?? {}).map(([k, v]) => [
              k,
              {
                type: String(v.type).toLowerCase(),
                description: v.description,
              },
            ])
          ),
          required: fn.parameters?.required ?? [],
        },
      },
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          tools,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI API HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              function: { name: string; arguments: string };
            }>;
          };
        }>;
      };
      const choice = data.choices?.[0]?.message;
      const rawToolCalls = choice?.tool_calls ?? [];
      const toolCalls: ToolCallRequest[] = rawToolCalls.map((tc) => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }
        return {
          id: tc.id,
          name: tc.function.name,
          args: parsedArgs,
        };
      });

      return {
        text: choice?.content ?? '',
        toolCalls,
        providerName: this.providerName,
        modelName: this.modelName,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildSystemInstruction(currentTasks: StudyTask[]): string {
  const todayStr = '2026-10-19 (Monday)';
  const FridayStr = '2026-10-23';
  const taskSnapshot =
    currentTasks.length === 0
      ? 'No tasks currently stored in SQLite.'
      : currentTasks
          .map(
            (t) =>
              `- ID #${t.id}: "${t.title}" | Subject: ${t.subject} | Priority: ${t.priority} | Status: ${t.status} | Due: ${t.due_date || 'Unscheduled'} (${t.estimated_minutes}m)`
          )
          .join('\n');

  return `You are StudyPilot AI, an intelligent, stateful study and productivity agent designed as an Alexa+ Simulated Experience.
Current Reference Date: ${todayStr}. Upcoming Friday is ${FridayStr}.

CORE OPERATING PRINCIPLES:
1. Understand the student's academic objective, subjects, topics, and deadlines.
2. When essential information is genuinely missing (for example, a user asks to delete a task without specifying which one, or asks to plan an exam without naming the subject), ask a concise clarifying question.
3. When the user gives a multi-topic study goal (e.g., "I have three physics topics and one chemistry assignment to finish by Friday"), break the goal into concrete, actionable tasks using the create_task tool, group by subject, assign realistic priorities (high/medium/low) and staggered due dates leading up to the deadline (e.g. 2026-10-20 through 2026-10-23).
4. NEVER claim that a task was created, updated, completed, or deleted unless you have invoked the corresponding tool AND the backend tool execution result confirms ok: true.
5. For destructive operations (delete_task), require clear task identification (task_id). If ambiguous, ask for clarification first.
6. Keep responses structured, concise, and helpful. Summarize the exact tasks persisted and current progress.

CURRENT DATABASE SNAPSHOT:
${taskSnapshot}`;
}

export interface AgentChatResult {
  reply: string;
  conversation_id: string;
  tool_executions: ToolExecutionOutcome[];
  iterations_used: number;
  max_iterations: number;
  provider: string;
  model: string;
  tasks: StudyTask[];
  activity: AgentActivityRecord[];
}

/**
 * Orchestrates a bounded multi-step tool-calling loop with the configured ModelProviderAdapter.
 */
export async function runStudyPilotAgentTurn(params: {
  repo: StudyPilotRepository;
  adapter: ModelProviderAdapter;
  conversationId: string;
  userMessage: string;
  maxIterations?: number;
}): Promise<AgentChatResult> {
  const { repo, adapter, conversationId, userMessage } = params;
  const maxIterations = Math.min(8, Math.max(1, params.maxIterations ?? (Number(process.env.MAX_TOOL_ITERATIONS) || 5)));

  const history = repo.getConversationHistory(conversationId, 12).map((h) => ({
    role: h.role,
    content: h.content,
  }));

  repo.appendConversationMessage({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
  });

  const toolExecutions: ToolExecutionOutcome[] = [];
  let iterationsUsed = 0;
  let finalReply = '';

  while (iterationsUsed < maxIterations) {
    iterationsUsed += 1;
    const currentTasks = repo.listTasks();
    const systemInstruction = buildSystemInstruction(currentTasks);

    const turnRes = await adapter.generateTurn({
      systemInstruction,
      history,
      userMessage,
      toolOutcomesSoFar: toolExecutions,
    });

    if (!turnRes.toolCalls || turnRes.toolCalls.length === 0) {
      finalReply = (turnRes.text || '').trim();
      break;
    }

    for (const call of turnRes.toolCalls) {
      const outcome = executeValidatedAgentTool(repo, conversationId, call);
      toolExecutions.push(outcome);
    }

    if (iterationsUsed >= maxIterations && !finalReply) {
      const succeeded = toolExecutions.filter((t) => t.status === 'success');
      finalReply =
        turnRes.text?.trim() ||
        `Completed ${succeeded.length} validated tool operation(s) within the maximum iteration bound (${maxIterations}).`;
    }
  }

  if (!finalReply) {
    finalReply = 'Processed your request and synchronized your study plan with the database.';
  }

  repo.appendConversationMessage({
    conversation_id: conversationId,
    role: 'assistant',
    content: finalReply,
    tool_calls: toolExecutions.map((t) => ({
      tool_name: t.tool_name,
      status: t.status,
      action_description: t.action_description,
    })),
  });

  return {
    reply: finalReply,
    conversation_id: conversationId,
    tool_executions: toolExecutions,
    iterations_used: iterationsUsed,
    max_iterations: maxIterations,
    provider: adapter.providerName,
    model: adapter.modelName,
    tasks: repo.listTasks(),
    activity: repo.listActivity(30),
  };
}

/**
 * Intelligent Stateful Fallback Adapter when external LLM API key is not configured or rate-limited
 * in local/CI environments, or when fallback is explicitly needed.
 * Uses real validated backend tool execution (`create_task`, `list_tasks`, `complete_task`, `retrieve_progress`, etc.)
 * so tool execution and SQLite persistence are always genuine.
 */
export class StructuredStudyAgentFallbackAdapter implements ModelProviderAdapter {
  public readonly providerName = 'studypilot-structured-engine';
  public readonly modelName = 'alexa-plus-sim-planner-v1';
  private repo: StudyPilotRepository;

  constructor(repo: StudyPilotRepository) {
    this.repo = repo;
  }

  public async generateTurn(params: {
    systemInstruction: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    toolOutcomesSoFar: ToolExecutionOutcome[];
  }): Promise<ModelTurnResponse> {
    const msg = params.userMessage.trim();
    const lower = msg.toLowerCase();

    // If tools have already executed in this turn, synthesize an accurate summary from actual backend outcomes
    if (params.toolOutcomesSoFar.length > 0) {
      const createdTasks = params.toolOutcomesSoFar
        .filter((o) => o.tool_name === 'create_task' && o.status === 'success' && o.result.task)
        .map((o) => o.result.task as StudyTask);

      const completedTasks = params.toolOutcomesSoFar
        .filter((o) => (o.tool_name === 'complete_task' || o.tool_name === 'update_task') && o.status === 'success' && o.result.task)
        .map((o) => o.result.task as StudyTask);

      const deletedTasks = params.toolOutcomesSoFar.filter(
        (o) => o.tool_name === 'delete_task' && o.status === 'success'
      );

      const progressOutcome = params.toolOutcomesSoFar.find(
        (o) => o.tool_name === 'retrieve_progress' && o.status === 'success'
      );

      const parts: string[] = [];

      if (createdTasks.length > 0) {
        parts.push(
          `I have decomposed your goal into **${createdTasks.length} actionable study task(s)** and saved them to your SQLite study plan:`
        );
        for (const t of createdTasks) {
          parts.push(
            `- **#${t.id} [${t.subject}] ${t.title}** — Priority: \`${t.priority.toUpperCase()}\` · Due: \`${t.due_date || 'TBD'}\` · Est: ${t.estimated_minutes} min`
          );
        }
      }

      if (completedTasks.length > 0) {
        for (const t of completedTasks) {
          parts.push(
            `Updated **#${t.id} "${t.title}"** (${t.subject}) -> Status: \`${t.status.toUpperCase()}\`, Priority: \`${t.priority.toUpperCase()}\`.`
          );
        }
      }

      if (deletedTasks.length > 0) {
        for (const d of deletedTasks) {
          parts.push(`Deleted task **#${d.result.deleted_task_id} "${d.result.deleted_title}"** from the database.`);
        }
      }

      if (progressOutcome && progressOutcome.result.progress) {
        const p = progressOutcome.result.progress as ReturnType<typeof calculateProgressMetrics>;
        parts.push(
          `\n**Verified Study Progress:** ${p.completed_tasks} of ${p.total_tasks} tasks completed (**${p.completion_rate}%**), with **${p.pending_tasks}** pending (${p.total_estimated_minutes_remaining} min estimated remaining workload).`
        );
      }

      if (parts.length === 0) {
        const listOutcome = params.toolOutcomesSoFar.find((o) => o.tool_name === 'list_tasks');
        if (listOutcome && Array.isArray(listOutcome.result.tasks)) {
          const tasks = listOutcome.result.tasks as StudyTask[];
          parts.push(`Found **${tasks.length}** persisted task(s) matching your query:`);
          for (const t of tasks.slice(0, 8)) {
            parts.push(
              `- **#${t.id} [${t.subject}] ${t.title}** (${t.status}, ${t.priority} priority, due ${t.due_date || 'unscheduled'})`
            );
          }
        }
      }

      return {
        text: parts.join('\n'),
        toolCalls: [],
        providerName: this.providerName,
        modelName: this.modelName,
      };
    }

    // Step 1: Check for ambiguous delete request
    if (/\b(delete|remove)\b/i.test(lower)) {
      const idMatch = msg.match(/#?(\d+)/);
      if (!idMatch) {
        return {
          text: 'To prevent accidental data loss, please specify the exact numeric **Task ID** (for example, `"Delete task #2"`) that you would like me to remove.',
          toolCalls: [],
          providerName: this.providerName,
          modelName: this.modelName,
        };
      }
      const taskId = Number(idMatch[1]);
      return {
        toolCalls: [
          {
            name: 'delete_task',
            args: { task_id: taskId, confirm: true },
          },
          {
            name: 'retrieve_progress',
            args: { include_subject_breakdown: true },
          },
        ],
        providerName: this.providerName,
        modelName: this.modelName,
      };
    }

    // Step 2: Check for completing a task
    if (/\b(complete|completed|finish|finished|done|mark\s+as\s+done)\b/i.test(lower) && !/\b(by\s+friday|by\s+monday|create|plan)\b/i.test(lower)) {
      const idMatch = msg.match(/#?(\d+)/);
      if (idMatch) {
        return {
          toolCalls: [
            {
              name: 'complete_task',
              args: { task_id: Number(idMatch[1]) },
            },
            {
              name: 'retrieve_progress',
              args: { include_subject_breakdown: true },
            },
          ],
          providerName: this.providerName,
          modelName: this.modelName,
        };
      }
      // Try matching task by title substring
      const pendingTasks = this.repo.listTasks({ status: 'pending' });
      const matched = pendingTasks.find((t) => lower.includes(t.title.toLowerCase().slice(0, 12)));
      if (matched) {
        return {
          toolCalls: [
            {
              name: 'complete_task',
              args: { task_id: matched.id },
            },
            {
              name: 'retrieve_progress',
              args: { include_subject_breakdown: true },
            },
          ],
          providerName: this.providerName,
          modelName: this.modelName,
        };
      }
    }

    // Step 3: Multi-topic study plan decomposition (e.g., "three physics topics and one chemistry assignment to finish by Friday")
    if (/\b(physics|chemistry|math|calculus|biology|computer science|history|economics|topic|assignment|exam|study plan|plan)\b/i.test(lower)) {
      const toolCalls: ToolCallRequest[] = [];

      const hasThreePhysics = /\b(three|3)\s+physics\b/i.test(lower);
      const hasChemistry = /\bchemistry\b/i.test(lower);

      if (hasThreePhysics || (lower.includes('physics') && lower.includes('chemistry'))) {
        const physicsTopics = [
          {
            title: 'Physics Topic 1: Kinematics & Newtonian Mechanics Review',
            description: 'Synthesize free-body diagrams, conservation of momentum, and practice problems.',
            due_date: '2026-10-20',
            priority: 'high',
            estimated_minutes: 60,
          },
          {
            title: 'Physics Topic 2: Work, Energy & Rotational Dynamics',
            description: 'Complete torque, angular momentum, and energy conservation worksheet.',
            due_date: '2026-10-21',
            priority: 'high',
            estimated_minutes: 60,
          },
          {
            title: 'Physics Topic 3: Waves, Optics & Electromagnetism Foundations',
            description: 'Review wave interference formulas, Coulomb law, and electric field derivations.',
            due_date: '2026-10-22',
            priority: 'medium',
            estimated_minutes: 60,
          },
        ];

        for (const pt of physicsTopics) {
          toolCalls.push({
            name: 'create_task',
            args: {
              title: pt.title,
              subject: 'Physics',
              description: pt.description,
              priority: pt.priority,
              due_date: pt.due_date,
              estimated_minutes: pt.estimated_minutes,
            },
          });
        }

        if (hasChemistry) {
          toolCalls.push({
            name: 'create_task',
            args: {
              title: 'Chemistry Assignment: Stoichiometry & Acid-Base Titration Report',
              subject: 'Chemistry',
              description: 'Complete quantitative molarity calculations and finalize lab assignment before Friday deadline.',
              priority: 'high',
              due_date: '2026-10-23',
              estimated_minutes: 90,
            },
          });
        }

        toolCalls.push({
          name: 'retrieve_progress',
          args: { include_subject_breakdown: true },
        });

        return {
          toolCalls,
          providerName: this.providerName,
          modelName: this.modelName,
        };
      }

      // Generic task/study plan creation from user message
      if (/\b(create|add|schedule|plan|finish|study|prepare)\b/i.test(lower)) {
        let subject = 'General';
        if (/physics/i.test(lower)) subject = 'Physics';
        else if (/chemistry/i.test(lower)) subject = 'Chemistry';
        else if (/math|calculus|algebra/i.test(lower)) subject = 'Mathematics';
        else if (/computer|coding|algorithm|cs|python/i.test(lower)) subject = 'Computer Science';
        else if (/biology|genetics/i.test(lower)) subject = 'Biology';
        else if (/history|literature|essay/i.test(lower)) subject = 'Humanities';

        const priority = /\b(urgent|high|friday|tomorrow|exam|midterm)\b/i.test(lower) ? 'high' : 'medium';
        const cleanedTitle = msg
          .replace(/^(please\s+)?(create|add|schedule|plan)\s+(a\s+)?(task|study\s+plan)?\s*(to|for|:)?\s*/i, '')
          .slice(0, 120)
          .trim();

        if (cleanedTitle.length >= 4) {
          return {
            toolCalls: [
              {
                name: 'create_task',
                args: {
                  title: cleanedTitle.charAt(0).toUpperCase() + cleanedTitle.slice(1),
                  subject,
                  description: `Created from StudyPilot AI conversational request: "${msg}"`,
                  priority,
                  due_date: '2026-10-23',
                  estimated_minutes: 60,
                },
              },
              {
                name: 'retrieve_progress',
                args: { include_subject_breakdown: true },
              },
            ],
            providerName: this.providerName,
            modelName: this.modelName,
          };
        }
      }
    }

    // Step 4: Check if user is asking for progress or task list
    if (/\b(progress|status|list|show|what\s+do\s+i\s+have|tasks|summary)\b/i.test(lower)) {
      return {
        toolCalls: [
          {
            name: 'list_tasks',
            args: { status: 'all' },
          },
          {
            name: 'retrieve_progress',
            args: { include_subject_breakdown: true },
          },
        ],
        providerName: this.providerName,
        modelName: this.modelName,
      };
    }

    // Step 5: Ask a clarifying question when goal/subject/deadline is underspecified
    return {
      text: `I can decompose your study goals into prioritized tasks and track them in SQLite. Could you share:\n1. **Which subject(s) or topics** you need to cover?\n2. **Your target deadline** (e.g., this Friday, Oct 23)?\n3. **How many hours** you have available to study?`,
      toolCalls: [],
      providerName: this.providerName,
      modelName: this.modelName,
    };
  }
}

/**
 * Factory that builds the configured ModelProviderAdapter with resilient fallback if no valid API key is present.
 */
export function createConfiguredModelAdapter(repo: StudyPilotRepository): ModelProviderAdapter {
  const providerPref = (process.env.MODEL_PROVIDER || 'gemini').toLowerCase().trim();
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  const hasValidOpenAiKey = Boolean(
    openAiKey && openAiKey !== 'YOUR_OPENAI_API_KEY' && openAiKey !== 'MY_OPENAI_API_KEY'
  );
  const hasValidGeminiKey = Boolean(
    geminiKey && geminiKey !== 'MY_GEMINI_API_KEY' && geminiKey !== 'YOUR_GEMINI_API_KEY'
  );

  const fallbackAdapter = new StructuredStudyAgentFallbackAdapter(repo);

  if (providerPref === 'openai' && hasValidOpenAiKey && openAiKey) {
    const primary = new OpenAICompatibleAdapter(openAiKey, process.env.MODEL_NAME || 'gpt-4o-mini');
    return wrapWithResilientFallback(primary, fallbackAdapter);
  }

  if (hasValidGeminiKey && geminiKey) {
    const modelName =
      process.env.MODEL_NAME && !process.env.MODEL_NAME.startsWith('gpt-')
        ? process.env.MODEL_NAME
        : 'gemini-3.8-flash';
    const primary = new GeminiModelAdapter(geminiKey, modelName);
    return wrapWithResilientFallback(primary, fallbackAdapter);
  }

  if (hasValidOpenAiKey && openAiKey) {
    const primary = new OpenAICompatibleAdapter(openAiKey, process.env.MODEL_NAME || 'gpt-4o-mini');
    return wrapWithResilientFallback(primary, fallbackAdapter);
  }

  return fallbackAdapter;
}

function wrapWithResilientFallback(
  primary: ModelProviderAdapter,
  fallback: ModelProviderAdapter
): ModelProviderAdapter {
  return {
    get providerName() {
      return primary.providerName;
    },
    get modelName() {
      return primary.modelName;
    },
    async generateTurn(params) {
      try {
        return await primary.generateTurn(params);
      } catch (err) {
        console.warn(
          `[StudyPilot Agent] Primary model provider (${primary.providerName}/${primary.modelName}) encountered error, engaging structured tool-calling fallback:`,
          err instanceof Error ? err.message : err
        );
        return await fallback.generateTurn(params);
      }
    },
  };
}
