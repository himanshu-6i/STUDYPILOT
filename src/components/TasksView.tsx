import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Search,
  Plus,
  Edit3,
  Trash2,
} from 'lucide-react';
import { type StudyTask, sortTasksByPriorityAndDeadline } from '../lib/validation.ts';

interface TasksViewProps {
  tasks: StudyTask[];
  onToggleTaskStatus: (task: StudyTask) => Promise<void>;
  onEditTask: (task: StudyTask) => void;
  onDeleteTask: (taskId: number) => Promise<void>;
  onOpenNewTaskModal: () => void;
}

export function TasksView({
  tasks,
  onToggleTaskStatus,
  onEditTask,
  onDeleteTask,
  onOpenNewTaskModal,
}: TasksViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.subject) set.add(t.subject);
    });
    return Array.from(set).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (subjectFilter !== 'all' && t.subject.toLowerCase() !== subjectFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description.toLowerCase().includes(q);
        const matchSub = t.subject.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchSub) return false;
      }
      return true;
    });
    return sortTasksByPriorityAndDeadline(filtered);
  }, [tasks, statusFilter, priorityFilter, subjectFilter, searchQuery]);

  return (
    <div className="pointer-events-auto flex min-h-[85vh] flex-col justify-between py-10">
      {/* Top Editorial Header + Frosted Glass Filter Bar */}
      <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
        <div className="flex items-center gap-3 pb-2 lg:col-span-3">
          <span className="text-xs font-semibold tracking-wider text-white/90 uppercase">
            My Tasks
          </span>
          <span className="h-px w-12 bg-white/60" />
        </div>

        <div className="lg:col-span-5">
          <h2 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl">
            Persistent SQLite
            <br />
            Study Task Matrix
          </h2>
          <p className="mt-2.5 text-xs text-white/90">
            Showing {filteredTasks.length} of {tasks.length} persisted tasks in SQLite. Click any
            task or 3D glass capsule to inspect.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 lg:col-span-4">
          <button
            type="button"
            onClick={onOpenNewTaskModal}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-lg transition-transform hover:scale-[1.02] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Study Task</span>
          </button>
        </div>
      </div>

      {/* Frosted Aero-Glass Filter Strip */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/18 p-3.5 text-white backdrop-blur-xl">
        {/* Status Filter */}
        <div className="flex items-center gap-1 rounded-xl bg-white/15 p-1">
          {(['all', 'pending', 'completed'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-1 rounded-xl bg-white/15 p-1">
          {(['all', 'high', 'medium', 'low'] as const).map((prio) => (
            <button
              key={prio}
              type="button"
              onClick={() => setPriorityFilter(prio)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                priorityFilter === prio
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-white/85 hover:text-white'
              }`}
            >
              {prio === 'all' ? 'All Priorities' : prio}
            </button>
          ))}
        </div>

        {/* Subject & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <label htmlFor="subject-filter-select" className="sr-only">
              Filter by Subject
            </label>
            <select
              id="subject-filter-select"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded-xl border border-white/40 bg-white/20 px-3 py-1.5 text-xs font-semibold text-white focus:border-white focus:outline-none"
            >
              <option value="all" className="text-slate-900">
                All Subjects
              </option>
              {subjects.map((sub) => (
                <option key={sub} value={sub} className="text-slate-900">
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-white/80" />
            <label htmlFor="task-search-input" className="sr-only">
              Search tasks
            </label>
            <input
              id="task-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-48 rounded-xl border border-white/40 bg-white/20 py-1.5 pr-3 pl-8 text-xs text-white placeholder-white/75 focus:border-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Architectural Task Grid with .01 / .02 / .03 Leader Lines & Frosted Glass Cards */}
      {filteredTasks.length === 0 ? (
        <div className="my-8 rounded-3xl border border-white/40 bg-white/18 p-10 text-center text-white backdrop-blur-xl">
          <p className="text-sm font-bold">No tasks match the active filter criteria.</p>
          <p className="mt-1 text-xs text-white/85">
            Reset filters or add a new study task to persist in SQLite.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task, idx) => {
            const isCompleted = task.status === 'completed';
            const numStr = `.${String(idx + 1).padStart(2, '0')}`;

            return (
              <div
                key={task.id}
                data-testid={`task-row-${task.id}`}
                className="flex flex-col justify-between rounded-[26px] border border-white/45 bg-white/20 p-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl transition-transform hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white/85">{numStr}</span>
                    <span className="rounded-lg bg-white/25 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-white uppercase">
                      {task.subject} · {task.priority}
                    </span>
                  </div>

                  {/* Subtle architectural angled divider */}
                  <svg className="my-2.5 h-4 w-full overflow-visible" viewBox="0 0 260 16" fill="none">
                    <path
                      d="M 0 14 L 225 14 L 250 2"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth="1.2"
                    />
                    <circle cx="250" cy="2" r="2.5" fill="#FFFFFF" />
                  </svg>

                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleTaskStatus(task)}
                      aria-label={`Mark "${task.title}" as ${isCompleted ? 'pending' : 'completed'}`}
                      className="mt-0.5 text-white hover:scale-110 transition-transform"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                      ) : (
                        <Circle className="h-5 w-5 text-white/85" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <h3
                        className={`font-display text-base font-bold leading-snug ${
                          isCompleted ? 'line-through text-white/65' : 'text-white'
                        }`}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-white/85">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/30 pt-3 font-mono text-[11px] text-white/90">
                  <div>
                    <span>Due: {task.due_date || 'Flexible'}</span>
                    <span className="mx-1.5">·</span>
                    <span>{task.estimated_minutes}m</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      aria-label={`Edit task ${task.title}`}
                      className="rounded-lg bg-white/20 p-1.5 text-white hover:bg-white hover:text-slate-900 transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    {confirmDeleteId === task.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            await onDeleteTask(task.id);
                            setConfirmDeleteId(null);
                          }}
                          className="rounded-lg bg-red-600 px-2 py-1 font-sans text-[10px] font-bold text-white hover:bg-red-500"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-lg bg-white/25 px-2 py-1 font-sans text-[10px] text-white"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(task.id)}
                        aria-label={`Delete task ${task.title}`}
                        className="rounded-lg bg-white/20 p-1.5 text-white hover:bg-red-500 hover:text-white transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
