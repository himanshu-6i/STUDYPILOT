import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import os from 'node:os';
import {
  type StudyTask,
  type CreateTaskInput,
  type UpdateTaskInput,
  type AgentActivityRecord,
  type ChatMessageRecord,
  validateCreateTaskInput,
  validateUpdateTaskInput,
  sanitizeForActivityLog,
} from '../lib/validation.ts';

export class StudyPilotRepository {
  private db: DatabaseSync;
  public readonly dbPath: string;

  constructor(customDbPath?: string) {
    const defaultPath = process.env.VERCEL
      ? path.join(os.tmpdir(), 'studypilot.db')
      : path.resolve(process.cwd(), 'studypilot.db');
    const candidatePath = customDbPath || process.env.DATABASE_PATH || defaultPath;

    try {
      this.db = new DatabaseSync(candidatePath);
      this.dbPath = candidatePath;
    } catch {
      const fallbackTmp = path.join(os.tmpdir(), 'studypilot.db');
      this.db = new DatabaseSync(fallbackTmp);
      this.dbPath = fallbackTmp;
    }
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT 'General',
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high')),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
        due_date TEXT,
        estimated_minutes INTEGER NOT NULL DEFAULT 45,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        tool_calls_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_cid ON conversations(conversation_id);

      CREATE TABLE IF NOT EXISTS agent_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        action_description TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('success', 'error')),
        arguments_summary TEXT NOT NULL DEFAULT '{}',
        result_summary TEXT NOT NULL DEFAULT '',
        duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);
  }

  public seedIfEmpty(): void {
    const countRow = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    if (countRow.count > 0) return;

    const now = new Date().toISOString();
    const initialTasks: Array<Required<CreateTaskInput>> = [
      {
        title: 'Synthesize Kinematics & Projectile Motion Equations',
        description: 'Complete Chapter 3 derivations and solve problems 3.12 through 3.24 with vector diagrams.',
        subject: 'Physics',
        priority: 'high',
        status: 'pending',
        due_date: '2026-10-21',
        estimated_minutes: 60,
      },
      {
        title: 'Thermodynamics First & Second Law Problem Set',
        description: 'Focus on Carnot cycle efficiency calculations and entropy change in irreversible processes.',
        subject: 'Physics',
        priority: 'high',
        status: 'pending',
        due_date: '2026-10-22',
        estimated_minutes: 75,
      },
      {
        title: 'Chemical Equilibrium & Le Chatelier Lab Analysis',
        description: 'Draft post-lab discussion comparing experimental spectrophotometry absorbance curves.',
        subject: 'Chemistry',
        priority: 'high',
        status: 'pending',
        due_date: '2026-10-23',
        estimated_minutes: 90,
      },
      {
        title: 'Linear Algebra Eigenvalues & Diagonalization Notes',
        description: 'Review characteristic polynomials and verify eigenspace basis vectors before quiz.',
        subject: 'Mathematics',
        priority: 'medium',
        status: 'completed',
        due_date: '2026-10-19',
        estimated_minutes: 45,
      },
    ];

    const insertStmt = this.db.prepare(`
      INSERT INTO tasks (title, description, subject, priority, status, due_date, estimated_minutes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of initialTasks) {
      insertStmt.run(
        t.title,
        t.description,
        t.subject,
        t.priority,
        t.status,
        t.due_date,
        t.estimated_minutes,
        now,
        now
      );
    }

    this.logActivity({
      conversation_id: 'system-seed',
      tool_name: 'retrieve_progress',
      action_description: 'Initialized workspace with baseline study schedule and verified SQLite persistence.',
      status: 'success',
      arguments_summary: JSON.stringify({ include_completed: true }),
      result_summary: 'Loaded 4 initial academic tasks across Physics, Chemistry, and Mathematics.',
      duration_ms: 4,
    });
  }

  public listTasks(filters?: {
    status?: string;
    priority?: string;
    subject?: string;
    search?: string;
  }): StudyTask[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];

    if (filters?.status && filters.status !== 'all') {
      clauses.push('status = ?');
      params.push(filters.status.toLowerCase());
    }
    if (filters?.priority && filters.priority !== 'all') {
      clauses.push('priority = ?');
      params.push(filters.priority.toLowerCase());
    }
    if (filters?.subject && filters.subject !== 'all') {
      clauses.push('LOWER(subject) = LOWER(?)');
      params.push(filters.subject.trim());
    }
    if (filters?.search && filters.search.trim() !== '') {
      clauses.push('(LOWER(title) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?) OR LOWER(subject) LIKE LOWER(?))');
      const likeTerm = `%${filters.search.trim()}%`;
      params.push(likeTerm, likeTerm, likeTerm);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sql = `
      SELECT id, title, description, subject, priority, status, due_date, estimated_minutes, created_at, updated_at
      FROM tasks
      ${whereSql}
      ORDER BY
        CASE status WHEN 'pending' THEN 0 ELSE 1 END ASC,
        CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ASC,
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END ASC,
        due_date ASC,
        id DESC
    `;

    const rows = this.db.prepare(sql).all(...params) as unknown as StudyTask[];
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      estimated_minutes: Number(r.estimated_minutes || 45),
    }));
  }

  public getTaskById(id: number): StudyTask | null {
    if (!Number.isInteger(id) || id <= 0) return null;
    const row = this.db
      .prepare(
        `SELECT id, title, description, subject, priority, status, due_date, estimated_minutes, created_at, updated_at
         FROM tasks WHERE id = ?`
      )
      .get(id) as unknown as StudyTask | undefined;
    if (!row) return null;
    return {
      ...row,
      id: Number(row.id),
      estimated_minutes: Number(row.estimated_minutes || 45),
    };
  }

  public findDuplicatePendingTask(title: string, subject: string): StudyTask | null {
    const row = this.db
      .prepare(
        `SELECT id, title, description, subject, priority, status, due_date, estimated_minutes, created_at, updated_at
         FROM tasks
         WHERE LOWER(title) = LOWER(?) AND LOWER(subject) = LOWER(?) AND status = 'pending'
         LIMIT 1`
      )
      .get(title.trim(), subject.trim()) as unknown as StudyTask | undefined;
    if (!row) return null;
    return {
      ...row,
      id: Number(row.id),
      estimated_minutes: Number(row.estimated_minutes || 45),
    };
  }

  public createTask(input: CreateTaskInput): StudyTask {
    const validated = validateCreateTaskInput(input);
    if (!validated.valid || !validated.data) {
      throw new Error(validated.error || 'Invalid task creation input.');
    }
    const data = validated.data;
    const now = new Date().toISOString();

    const result = this.db
      .prepare(
        `INSERT INTO tasks (title, description, subject, priority, status, due_date, estimated_minutes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.title,
        data.description,
        data.subject,
        data.priority,
        data.status,
        data.due_date,
        data.estimated_minutes,
        now,
        now
      );

    const insertedId = Number(result.lastInsertRowid);
    const created = this.getTaskById(insertedId);
    if (!created) {
      throw new Error('Failed to retrieve newly created task from database.');
    }
    return created;
  }

  public updateTask(id: number, input: UpdateTaskInput): StudyTask | null {
    const existing = this.getTaskById(id);
    if (!existing) {
      return null;
    }

    const validated = validateUpdateTaskInput(input);
    if (!validated.valid || !validated.data) {
      throw new Error(validated.error || 'Invalid task update input.');
    }
    const updates = validated.data;
    const now = new Date().toISOString();

    const nextTitle = updates.title !== undefined ? updates.title : existing.title;
    const nextDescription = updates.description !== undefined ? updates.description : existing.description;
    const nextSubject = updates.subject !== undefined ? updates.subject : existing.subject;
    const nextPriority = updates.priority !== undefined ? updates.priority : existing.priority;
    const nextStatus = updates.status !== undefined ? updates.status : existing.status;
    const nextDueDate = updates.due_date !== undefined ? updates.due_date : existing.due_date;
    const nextEstMinutes =
      updates.estimated_minutes !== undefined ? updates.estimated_minutes : existing.estimated_minutes;

    this.db
      .prepare(
        `UPDATE tasks
         SET title = ?, description = ?, subject = ?, priority = ?, status = ?, due_date = ?, estimated_minutes = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        nextTitle,
        nextDescription,
        nextSubject,
        nextPriority,
        nextStatus,
        nextDueDate,
        nextEstMinutes,
        now,
        id
      );

    return this.getTaskById(id);
  }

  public deleteTask(id: number): boolean {
    const existing = this.getTaskById(id);
    if (!existing) return false;
    const res = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return Number(res.changes) > 0;
  }

  public logActivity(entry: {
    conversation_id: string;
    tool_name: string;
    action_description: string;
    status: 'success' | 'error';
    arguments_summary?: string | Record<string, unknown>;
    result_summary: string;
    duration_ms?: number;
  }): AgentActivityRecord {
    const now = new Date().toISOString();
    const argsStr =
      typeof entry.arguments_summary === 'string'
        ? entry.arguments_summary
        : sanitizeForActivityLog(entry.arguments_summary ?? {});

    const res = this.db
      .prepare(
        `INSERT INTO agent_activity (conversation_id, tool_name, action_description, status, arguments_summary, result_summary, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.conversation_id || 'default-session',
        entry.tool_name,
        entry.action_description,
        entry.status,
        argsStr,
        entry.result_summary.slice(0, 500),
        Math.max(0, Math.round(entry.duration_ms ?? 0)),
        now
      );

    const id = Number(res.lastInsertRowid);
    return {
      id,
      conversation_id: entry.conversation_id || 'default-session',
      tool_name: entry.tool_name,
      action_description: entry.action_description,
      status: entry.status,
      arguments_summary: argsStr,
      result_summary: entry.result_summary.slice(0, 500),
      duration_ms: Math.max(0, Math.round(entry.duration_ms ?? 0)),
      created_at: now,
    };
  }

  public listActivity(limit = 50): AgentActivityRecord[] {
    const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
    const rows = this.db
      .prepare(
        `SELECT id, conversation_id, tool_name, action_description, status, arguments_summary, result_summary, duration_ms, created_at
         FROM agent_activity
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(safeLimit) as unknown as AgentActivityRecord[];

    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      duration_ms: Number(r.duration_ms || 0),
    }));
  }

  public appendConversationMessage(entry: {
    conversation_id: string;
    role: 'user' | 'assistant';
    content: string;
    tool_calls?: unknown[];
  }): ChatMessageRecord {
    const now = new Date().toISOString();
    const toolCallsJson = JSON.stringify(entry.tool_calls ?? []);
    const res = this.db
      .prepare(
        `INSERT INTO conversations (conversation_id, role, content, tool_calls_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(entry.conversation_id, entry.role, entry.content, toolCallsJson, now);

    return {
      id: Number(res.lastInsertRowid),
      conversation_id: entry.conversation_id,
      role: entry.role,
      content: entry.content,
      tool_calls_json: toolCallsJson,
      created_at: now,
    };
  }

  public getConversationHistory(conversationId: string, limit = 20): ChatMessageRecord[] {
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
    const rows = this.db
      .prepare(
        `SELECT id, conversation_id, role, content, tool_calls_json, created_at
         FROM (
           SELECT id, conversation_id, role, content, tool_calls_json, created_at
           FROM conversations
           WHERE conversation_id = ?
           ORDER BY id DESC
           LIMIT ?
         )
         ORDER BY id ASC`
      )
      .all(conversationId, safeLimit) as unknown as ChatMessageRecord[];

    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
    }));
  }

  public clearConversationHistory(conversationId: string): void {
    this.db.prepare('DELETE FROM conversations WHERE conversation_id = ?').run(conversationId);
  }

  public close(): void {
    this.db.close();
  }
}
