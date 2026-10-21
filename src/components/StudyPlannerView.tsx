import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import type { StudyTask, ProgressMetrics } from '../lib/validation.ts';

interface StudyPlannerViewProps {
  tasks: StudyTask[];
  progress: ProgressMetrics;
  isGeneratingPlan: boolean;
  onGenerateStudyPlan: (goalPrompt: string) => Promise<void>;
  onToggleTaskStatus: (task: StudyTask) => Promise<void>;
  onExportStudyPlan?: () => void;
}

const PLANNER_TEMPLATES = [
  {
    title: 'Friday STEM Sprint (3 Physics + 1 Chemistry)',
    prompt:
      'I have three physics topics and one chemistry assignment to finish by Friday. Create a realistic study plan, prioritize everything, and help me track my progress.',
  },
  {
    title: 'Midterm Exam Decomposition',
    prompt:
      'I have a Calculus II exam and a Computer Science Algorithms project due in 4 days. Break this into prioritized study sessions and save them to my plan.',
  },
  {
    title: 'Clarify Missing Constraints Demo',
    prompt: 'I need a study plan for my upcoming finals.',
  },
];

export function StudyPlannerView({
  tasks,
  progress,
  isGeneratingPlan,
  onGenerateStudyPlan,
  onToggleTaskStatus,
  onExportStudyPlan,
}: StudyPlannerViewProps) {
  const [goalInput, setGoalInput] = useState('');

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = goalInput.trim();
    if (!trimmed || isGeneratingPlan) return;
    setGoalInput('');
    await onGenerateStudyPlan(trimmed);
  };

  // Group tasks by subject
  const groupedBySubject = tasks.reduce<Record<string, StudyTask[]>>((acc, task) => {
    const key = task.subject || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const subjectKeys = Object.keys(groupedBySubject).sort();

  return (
    <div className="pointer-events-auto flex min-h-[85vh] flex-col justify-between py-10">
      {/* Top Editorial Header matching Video 00:02–00:05 */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex items-center gap-3 pt-2 lg:col-span-3">
          <span className="text-xs font-semibold tracking-wider text-white/90 uppercase">
            Study Planner
          </span>
          <span className="h-px w-12 bg-white/60" />
        </div>

        <div className="lg:col-span-5">
          <h2 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl">
            The Basics of
            <br />
            AI Study Goal
            <br />
            Decomposition
          </h2>
          <p className="mt-3 max-w-md text-xs leading-relaxed text-white/90">
            Describe your subjects, assignments, and target deadline. StudyPilot AI decomposes your
            goal into prioritized SQLite tasks through validated backend tool calls.
          </p>
          {onExportStudyPlan && (
            <button
              type="button"
              onClick={onExportStudyPlan}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/45 bg-white/20 px-4 py-2 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-slate-900"
            >
              <span>Download Study Plan (.md)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Frosted Glass Goal Input Card on Right (Aero-Glass Style) */}
        <div className="lg:col-span-4">
          <div className="rounded-[28px] border border-white/45 bg-white/22 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold tracking-wider text-white/90 uppercase">
                AI Goal Decomposer
              </span>
              <span className="font-mono text-xs font-bold text-white">
                {progress.total_estimated_minutes_remaining}m left
              </span>
            </div>

            <form onSubmit={handlePlanSubmit} className="mt-3 space-y-3">
              <label htmlFor="study-planner-goal-input" className="sr-only">
                Study Goal Description
              </label>
              <textarea
                id="study-planner-goal-input"
                rows={3}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                disabled={isGeneratingPlan}
                placeholder="e.g., I have three physics topics and one chemistry assignment to finish by Friday..."
                className="w-full rounded-2xl border border-white/45 bg-white/20 px-3.5 py-2.5 text-xs text-white placeholder-white/75 focus:border-white focus:bg-white/30 focus:outline-none disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={isGeneratingPlan || !goalInput.trim()}
                className="flex w-full items-center justify-between rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-900 shadow-lg transition-transform hover:scale-[1.01] disabled:opacity-50"
              >
                {isGeneratingPlan ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" />
                    <span>Running SQLite Tool Loop...</span>
                  </span>
                ) : (
                  <>
                    <span>Decompose &amp; Save Study Plan</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Template Pills */}
            <div className="mt-4 space-y-1.5 border-t border-white/30 pt-3">
              <span className="block font-mono text-[10px] tracking-wider text-white/80 uppercase">
                One-Click Demo Scenarios:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PLANNER_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.title}
                    type="button"
                    disabled={isGeneratingPlan}
                    onClick={() => onGenerateStudyPlan(tpl.prompt)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/35 bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/30 disabled:opacity-50"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>{tpl.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Architectural Subject Columns (.01 / .02 / .03) with Angled White SVG Leader Lines */}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {subjectKeys.slice(0, 3).map((subject, idx) => {
          const subjectTasks = groupedBySubject[subject];
          const completedCount = subjectTasks.filter((t) => t.status === 'completed').length;
          const numLabel = `.0${idx + 1}`;

          return (
            <div key={subject} className="relative pt-2">
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-display text-2xl font-bold text-white">{subject}</h3>
                <span className="font-mono text-xs font-semibold text-white/85">
                  {completedCount}/{subjectTasks.length} Done
                </span>
              </div>

              {/* Architectural angled white leader line (matching Video 00:03) */}
              <svg className="h-7 w-full overflow-visible" viewBox="0 0 300 28" fill="none">
                <path
                  d="M 0 26 L 245 26 L 280 2"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth="1.2"
                />
                <circle cx="280" cy="2" r="3" fill="#FFFFFF" />
              </svg>

              <div className="mt-3 flex items-start gap-3 border-l border-white/45 pl-4">
                <span className="font-mono text-xs font-bold text-white/85">{numLabel}</span>
                <div className="w-full space-y-2">
                  {subjectTasks.map((task) => {
                    const isDone = task.status === 'completed';
                    return (
                      <div
                        key={task.id}
                        className="flex items-start justify-between gap-2.5 rounded-2xl border border-white/35 bg-white/18 p-3 text-white backdrop-blur-md transition-colors hover:bg-white/25"
                      >
                        <button
                          type="button"
                          onClick={() => onToggleTaskStatus(task)}
                          aria-label={`Mark "${task.title}" as ${isDone ? 'pending' : 'completed'}`}
                          className="mt-0.5 text-white hover:scale-110 transition-transform"
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                          ) : (
                            <Circle className="h-4 w-4 text-white/80" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-semibold ${
                              isDone ? 'line-through text-white/60' : 'text-white'
                            }`}
                          >
                            {task.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] text-white/80">
                            <span className="uppercase">{task.priority}</span>
                            <span>·</span>
                            <span>{task.due_date || 'Flexible'}</span>
                            <span>·</span>
                            <span>{task.estimated_minutes}m</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
