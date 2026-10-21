import React, { useState, useEffect } from 'react';
import { X, AlertCircle, ArrowRight } from 'lucide-react';
import type { StudyTask, CreateTaskInput, TaskPriority, TaskStatus } from '../lib/validation.ts';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
  initialTask?: StudyTask | null;
}

export function TaskModal({ isOpen, onClose, onSubmit, initialTask }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('pending');
  const [dueDate, setDueDate] = useState('2026-10-23');
  const [estimatedMinutes, setEstimatedMinutes] = useState(45);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description || '');
      setSubject(initialTask.subject || 'General');
      setPriority(initialTask.priority);
      setStatus(initialTask.status);
      setDueDate(initialTask.due_date || '');
      setEstimatedMinutes(initialTask.estimated_minutes || 45);
    } else {
      setTitle('');
      setDescription('');
      setSubject('Physics');
      setPriority('high');
      setStatus('pending');
      setDueDate('2026-10-23');
      setEstimatedMinutes(45);
    }
    setError(null);
  }, [initialTask, isOpen]);

  if (!isOpen) return null;

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Task title is required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmedTitle,
        description: description.trim(),
        subject: subject.trim() || 'General',
        priority,
        status,
        due_date: dueDate.trim() ? dueDate.trim() : null,
        estimated_minutes: Number(estimatedMinutes) || 45,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="w-full max-w-md rounded-[28px] border border-white bg-white p-6 text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.35)]">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="font-mono text-[10px] font-bold tracking-wider text-sky-600 uppercase">
              SQLite Validated Record
            </span>
            <h2
              id="task-modal-title"
              className="font-display text-lg font-bold tracking-tight text-slate-900"
            >
              {initialTask ? 'Edit Study Task' : 'New Study Task'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="mt-4 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="task-title-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Task Title *
            </label>
            <input
              id="task-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Physics Topic 1: Kinematics & Projectile Motion"
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="task-subject-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Subject / Course
              </label>
              <input
                id="task-subject-input"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Physics, Chemistry"
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="task-priority-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Priority Level
              </label>
              <select
                id="task-priority-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="task-due-date-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Due Date
              </label>
              <input
                id="task-due-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="task-minutes-input"
                className="block text-xs font-semibold text-slate-700"
              >
                Est. Minutes
              </label>
              <input
                id="task-minutes-input"
                type="number"
                min={5}
                max={600}
                step={5}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="task-status-select"
                className="block text-xs font-semibold text-slate-700"
              >
                Status
              </label>
              <select
                id="task-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
              >
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="task-desc-input"
              className="block text-xs font-semibold text-slate-700"
            >
              Actionable Study Notes / Deliverable
            </label>
            <textarea
              id="task-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Outline specific chapters, problem sets, or review milestones..."
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2B7FFF] to-[#38BDF8] px-5 py-2.5 text-xs font-bold text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              <span>
                {submitting ? 'Saving...' : initialTask ? 'Save Changes' : 'Create Study Task'}
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
