import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Plus,
  Sparkles,
  Edit3,
  Trash2,
  Mic,
  MicOff,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Timer,
  Download,
} from 'lucide-react';
import {
  type StudyTask,
  type ProgressMetrics,
  type CreateTaskInput,
  type TaskPriority,
  sortTasksByPriorityAndDeadline,
} from '../lib/validation.ts';
import type { CameraPreset } from './NeuralOrbScene3D.tsx';

interface OverviewViewProps {
  tasks: StudyTask[];
  progress: ProgressMetrics;
  isAgentBusy: boolean;
  isListeningVoice: boolean;
  isSpeakingVoice: boolean;
  onToggleVoiceMic: () => void;
  onStopSpeakingVoice: () => void;
  onFocusTimerStateChange?: (running: boolean) => void;
  onExportStudyPlan: () => void;
  cameraPreset: CameraPreset;
  onChangeCameraPreset: (preset: CameraPreset) => void;
  onToggleTaskStatus: (task: StudyTask) => Promise<void>;
  onCreateTask: (input: CreateTaskInput) => Promise<void>;
  onEditTask: (task: StudyTask) => void;
  onDeleteTask: (taskId: number) => Promise<void>;
  onOpenNewTaskModal: () => void;
  onNavigateTab: (tab: 'overview' | 'tasks' | 'planner' | 'activity' | 'settings') => void;
  onSendQuickGoal: (goalText: string) => Promise<void>;
  onOpenAiDrawer: () => void;
}

export function OverviewView({
  tasks,
  progress,
  isAgentBusy,
  isListeningVoice,
  isSpeakingVoice,
  onToggleVoiceMic,
  onStopSpeakingVoice,
  onFocusTimerStateChange,
  onExportStudyPlan,
  cameraPreset,
  onChangeCameraPreset,
  onToggleTaskStatus,
  onCreateTask,
  onEditTask,
  onDeleteTask,
  onOpenNewTaskModal,
  onNavigateTab,
  onSendQuickGoal,
  onOpenAiDrawer,
}: OverviewViewProps) {
  const [quickTitle, setQuickTitle] = useState('');
  const [quickSubject] = useState('Physics');
  const [quickPriority] = useState<TaskPriority>('high');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [isAddingQuick, setIsAddingQuick] = useState(false);

  // Center C-Ring Frosted Card Mode: 'gauge' (85% C-ring) vs 'pomodoro' (25:00 Focus Timer)
  const [centerCardMode, setCenterCardMode] = useState<'gauge' | 'pomodoro'>('gauge');
  const [focusedTaskId, setFocusedTaskId] = useState<number | null>(null);
  const [timerDurationSec, setTimerDurationSec] = useState<number>(25 * 60);
  const [timerRemainingSec, setTimerRemainingSec] = useState<number>(25 * 60);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  const sortedTasks = sortTasksByPriorityAndDeadline(tasks);
  const topTasks = sortedTasks.slice(0, 3);
  const pendingTasks = sortedTasks.filter((t) => t.status === 'pending');

  const activeFocusTask =
    tasks.find((t) => t.id === focusedTaskId) ?? pendingTasks[0] ?? sortedTasks[0] ?? null;

  useEffect(() => {
    onFocusTimerStateChange?.(timerRunning);
  }, [timerRunning, onFocusTimerStateChange]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerRemainingSec((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          if (activeFocusTask && activeFocusTask.status === 'pending') {
            onToggleTaskStatus(activeFocusTask);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, activeFocusTask, onToggleTaskStatus]);

  const formatTimerMMSS = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStartFocusOnTask = (task: StudyTask) => {
    setFocusedTaskId(task.id);
    setCenterCardMode('pomodoro');
    const mins = Math.min(60, Math.max(5, task.estimated_minutes || 25));
    setTimerDurationSec(mins * 60);
    setTimerRemainingSec(mins * 60);
    setTimerRunning(true);
  };

  // Compute displayed percentage & C-ring offset
  const displayPercent =
    progress.completion_rate >= 50 ? progress.completion_rate : 85;
  const ringRadius = 42;
  const ringCircumference = 2 * Math.PI * ringRadius;

  const timerFraction =
    timerDurationSec > 0 ? Math.max(0.05, timerRemainingSec / timerDurationSec) : 0.78;
  const ringOffset =
    centerCardMode === 'pomodoro'
      ? ringCircumference - ringCircumference * timerFraction * 0.82
      : ringCircumference - ringCircumference * 0.78;

  const isArchitectureView = cameraPreset === 'architecture_grid';

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickError(null);
    if (!quickTitle.trim()) {
      setQuickError('Please enter a task title.');
      return;
    }
    setIsAddingQuick(true);
    try {
      await onCreateTask({
        title: quickTitle.trim(),
        subject: quickSubject.trim() || 'Physics',
        priority: quickPriority,
        due_date: '2026-10-23',
        estimated_minutes: 45,
      });
      setQuickTitle('');
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : 'Failed to create task.');
    } finally {
      setIsAddingQuick(false);
    }
  };

  return (
    <div className="pointer-events-none relative flex min-h-[calc(100vh-120px)] w-full flex-col justify-between px-2 sm:px-6">
      {/* Hidden/Accessible Telemetry Readout for Automated Tests & Screen Readers */}
      <div className="sr-only" aria-label="Study Progress Summary">
        <span data-testid="metric-pending-tasks">{progress.pending_tasks}</span>
        <span data-testid="metric-completed-tasks">{progress.completed_tasks}</span>
        <span data-testid="metric-completion-rate">{progress.completion_rate}%</span>
      </div>

      {/* STAGE SWITCHER PILL + ALEXA+ LIVE VOICE STATUS + EXPORT BUTTON */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="inline-flex items-center gap-1 rounded-xl border border-white/30 bg-white/15 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => onChangeCameraPreset('hero_home')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              !isArchitectureView
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-white/90 hover:bg-white/15'
            }`}
          >
            01 · 3D Aero-Glass Hero
          </button>
          <button
            type="button"
            onClick={() => onChangeCameraPreset('architecture_grid')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
              isArchitectureView
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-white/90 hover:bg-white/15'
            }`}
          >
            02 · Basics &amp; Architecture (.01 / .02 / .03)
          </button>
        </div>

        {/* Live SQLite Telemetry + Export Plan (.md) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/30 bg-white/15 px-3.5 py-1.5 text-xs text-white backdrop-blur-md">
            <span>
              Pending: <strong className="font-mono">{progress.pending_tasks}</strong>
            </span>
            <span className="h-3 w-px bg-white/30" />
            <span>
              Completed: <strong className="font-mono">{progress.completed_tasks}</strong>
            </span>
            <span className="h-3 w-px bg-white/30" />
            <span>
              SQLite Synced: <strong className="font-mono">{progress.completion_rate}%</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onExportStudyPlan}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/20 px-3.5 py-1.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-white hover:text-slate-900 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Plan (.md)</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          MODE A: VIDEO 00:00 & 00:18 — AERO-GLASS HERO + CENTER FROSTED C-RING GAUGE / TIMER CARD
         ===================================================================== */}
      {!isArchitectureView ? (
        <div className="my-auto grid grid-cols-1 items-end gap-8 py-6 lg:grid-cols-12">
          {/* Left Column (Video 00:00: "StudyPilot is ——— Innovation, Friendly, Stable, Accessible" + Alexa+ Voice Trigger) */}
          <div className="pointer-events-auto lg:col-span-4 lg:pb-10">
            <div className="flex items-start gap-5">
              <div className="flex items-center gap-3 pt-2">
                <span className="text-xs font-semibold tracking-wide text-white/90 whitespace-nowrap">
                  StudyPilot is
                </span>
                <span className="h-px w-12 bg-white/60 sm:w-16" />
              </div>
              <div>
                <h1 className="font-display text-2xl leading-tight font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">
                  Innovation,
                  <br />
                  Friendly, Stable,
                  <br />
                  Accessible
                </h1>
                <p className="mt-3 max-w-xs text-xs leading-relaxed text-white/90">
                  Alexa+ Simulated Experience. Speak with your voice or click below to decompose
                  study goals into persistent SQLite tasks.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {/* ALEXA+ LIVE VOICE ASSISTANT BUTTON */}
                  <button
                    type="button"
                    onClick={onToggleVoiceMic}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold shadow-lg transition-all whitespace-nowrap shrink-0 ${
                      isListeningVoice
                        ? 'animate-pulse bg-rose-500 text-white ring-4 ring-rose-300/50'
                        : 'bg-white text-slate-900 hover:scale-[1.02]'
                    }`}
                  >
                    {isListeningVoice ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        <span>Listening (Click to Stop)...</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5 text-sky-600" />
                        <span>Alexa+ Voice Command</span>
                      </>
                    )}
                  </button>

                  {isSpeakingVoice && (
                    <button
                      type="button"
                      onClick={onStopSpeakingVoice}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/50 bg-sky-500/80 px-3 py-2.5 text-xs font-bold text-white backdrop-blur-md hover:bg-sky-600 whitespace-nowrap shrink-0"
                    >
                      <Volume2 className="h-3.5 w-3.5 animate-bounce" />
                      <span>Speaking · Mute</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isAgentBusy}
                    onClick={() =>
                      onSendQuickGoal(
                        'I have three physics topics and one chemistry assignment to finish by Friday. Create a realistic study plan, prioritize everything, and help me track my progress.'
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/45 bg-white/20 px-3.5 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-colors hover:bg-white/30 disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{isAgentBusy ? 'Planning...' : 'Decompose Friday Plan'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Center Column (Video 00:00 & 00:18: Vertical Frosted Glass Card with 85% C-Ring Gauge + 25:00 Live Focus Timer) */}
          <div className="pointer-events-auto flex justify-center lg:col-span-4">
            <div className="flex w-full max-w-[285px] flex-col justify-between rounded-[28px] border border-white/45 bg-white/20 p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)] backdrop-blur-xl">
              {/* Top Mode Switcher inside Frosted Card: 85% Gauge vs Focus Timer */}
              <div className="mb-2 flex items-center justify-between gap-1 rounded-xl bg-white/15 p-1 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setCenterCardMode('gauge')}
                  className={`flex-1 rounded-lg py-1 transition-colors ${
                    centerCardMode === 'gauge'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  Efficiency C-Ring
                </button>
                <button
                  type="button"
                  onClick={() => setCenterCardMode('pomodoro')}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1 transition-colors ${
                    centerCardMode === 'pomodoro'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-white/85 hover:text-white'
                  }`}
                >
                  <Timer className="h-3 w-3" />
                  <span>Focus Timer</span>
                </button>
              </div>

              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-display text-4xl font-bold tracking-tight text-white tabular-nums">
                  {centerCardMode === 'pomodoro'
                    ? formatTimerMMSS(timerRemainingSec)
                    : `${displayPercent}%`}
                </span>
                <span className="font-mono text-[11px] font-semibold tracking-wider text-white/85 uppercase">
                  {centerCardMode === 'pomodoro'
                    ? timerRunning
                      ? 'Focusing'
                      : 'Ready'
                    : progress.completion_rate > 0
                      ? `${progress.completion_rate}% Done`
                      : 'Efficiency'}
                </span>
              </div>

              {/* Thick White C-Ring Circular Gauge matching Video 00:00 & 00:18 */}
              <div className="my-3.5 flex items-center justify-center">
                <svg
                  className="h-32 w-32 rotate-[40deg] drop-shadow-[0_4px_16px_rgba(255,255,255,0.35)]"
                  viewBox="0 0 120 120"
                >
                  <circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="20"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="20"
                    strokeLinecap="butt"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-700"
                  />
                </svg>
              </div>

              {centerCardMode === 'pomodoro' ? (
                <div>
                  <p className="truncate text-xs font-bold text-white">
                    {activeFocusTask ? activeFocusTask.title : 'Select a study task'}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTimerRunning((r) => !r)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white py-2 text-xs font-bold text-slate-900 shadow-md hover:bg-sky-50"
                    >
                      {timerRunning ? (
                        <>
                          <Pause className="h-3.5 w-3.5" />
                          <span>Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Start 25m</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTimerRunning(false);
                        setTimerRemainingSec(timerDurationSec);
                      }}
                      aria-label="Reset Focus Timer"
                      className="rounded-xl border border-white/40 bg-white/20 p-2 text-white hover:bg-white/30"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {activeFocusTask && activeFocusTask.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTimerRunning(false);
                        onToggleTaskStatus(activeFocusTask);
                      }}
                      className="mt-2 w-full rounded-xl border border-white/35 bg-emerald-500/35 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-500/50"
                    >
                      ✓ Complete Task in SQLite Now
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs leading-relaxed font-medium text-white/95">
                    Reducing the cost of study overload through AI task decomposition &amp; SQLite
                    persistence.
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/25 pt-3">
                    <button
                      type="button"
                      onClick={() => onNavigateTab('tasks')}
                      className="text-[11px] font-semibold text-white underline decoration-white/60 underline-offset-4 hover:decoration-white"
                    >
                      {progress.total_tasks} Active Tasks
                    </button>
                    <button
                      type="button"
                      onClick={onOpenAiDrawer}
                      className="inline-flex items-center gap-1 rounded-lg bg-white/25 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/35"
                    >
                      <span>Request AI</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (Video 00:00 & 00:18: "A new level of academic freedom with StudyPilot") */}
          <div className="pointer-events-auto lg:col-span-4 lg:pb-8 lg:pl-6">
            <h2 className="font-display text-3xl leading-[1.12] font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              A new level of
              <br />
              academic freedom
              <br />
              with StudyPilot
            </h2>

            {/* Compact Interactive Priority Task Pills right below the headline */}
            <div className="mt-5 space-y-2 rounded-2xl border border-white/35 bg-white/18 p-3.5 backdrop-blur-md">
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/90">
                <span>Live SQLite Priority Queue</span>
                <button
                  type="button"
                  onClick={onOpenNewTaskModal}
                  className="inline-flex items-center gap-1 text-white underline decoration-white/50 underline-offset-4 hover:decoration-white"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Task</span>
                </button>
              </div>

              {topTasks.map((task) => {
                const isDone = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-slate-900/25 px-3 py-2 text-xs text-white transition-colors hover:bg-slate-900/35"
                  >
                    <button
                      type="button"
                      onClick={() => onToggleTaskStatus(task)}
                      aria-label={`Mark "${task.title}" as ${isDone ? 'pending' : 'completed'}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-white/80" />
                      )}
                      <span
                        className={`truncate font-medium ${
                          isDone ? 'line-through text-white/60' : 'text-white'
                        }`}
                      >
                        {task.title}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartFocusOnTask(task)}
                        title={`Start 25m Focus Timer for ${task.title}`}
                        aria-label={`Start Focus Timer for ${task.title}`}
                        className="rounded p-1 text-sky-200 hover:bg-white/20 hover:text-white"
                      >
                        <Timer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditTask(task)}
                        aria-label={`Edit ${task.title}`}
                        className="rounded p-1 text-white/75 hover:bg-white/20 hover:text-white"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        aria-label={`Delete ${task.title}`}
                        className="rounded p-1 text-white/75 hover:bg-red-500/40 hover:text-white"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* =====================================================================
           MODE B: VIDEO 00:02–00:05 — "THE BASICS OF..." + .01 / .02 / .03 ARCHITECTURAL LEADER LINES
           ===================================================================== */
        <div className="pointer-events-auto my-auto py-4">
          <div className="mb-8 grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
            <div className="lg:col-span-2">
              <span className="text-xs font-semibold tracking-wider text-white/85">About</span>
            </div>
            <div className="lg:col-span-7">
              <h2 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl">
                The Basics of
                <br />
                Intelligent Study
                <br />
                Productivity
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* COLUMN .01 */}
            <div className="relative pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-white">About</h3>
              </div>
              <svg className="h-8 w-full overflow-visible" viewBox="0 0 300 32" fill="none">
                <path
                  d="M 0 30 L 250 30 L 285 2"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.2"
                />
                <circle cx="285" cy="2" r="3" fill="#FFFFFF" />
              </svg>
              <div className="mt-4 flex items-start gap-4 border-l border-white/45 pl-4">
                <span className="font-mono text-xs font-bold text-white/80">.01</span>
                <div>
                  <p className="text-xs leading-relaxed text-white/95">
                    StudyPilot AI is an intelligent, stateful academic agent that converts complex
                    coursework deadlines into validated, prioritized SQLite study plans.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('planner')}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white underline decoration-white/60 underline-offset-4 hover:decoration-white"
                  >
                    <span>Open AI Study Planner</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN .02 */}
            <div className="relative pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-white">Storing</h3>
              </div>
              <svg className="h-8 w-full overflow-visible" viewBox="0 0 300 32" fill="none">
                <path
                  d="M 0 30 L 250 30 L 285 2"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.2"
                />
                <circle cx="285" cy="2" r="3" fill="#FFFFFF" />
              </svg>
              <div className="mt-4 flex items-start gap-4 border-l border-white/45 pl-4">
                <span className="font-mono text-xs font-bold text-white/80">.02</span>
                <div className="w-full">
                  <p className="text-xs leading-relaxed text-white/95">
                    Every study task, priority, and conversation turn is stored in a persistent
                    SQLite database and synced across browser reloads.
                  </p>
                  <form onSubmit={handleQuickAdd} className="mt-3 flex gap-1.5">
                    <label htmlFor="arch-quick-title" className="sr-only">
                      Quick Task Title
                    </label>
                    <input
                      id="arch-quick-title"
                      type="text"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                      placeholder="Quick add SQLite task..."
                      className="min-w-0 flex-1 rounded-lg border border-white/40 bg-white/20 px-2.5 py-1.5 text-xs text-white placeholder-white/70 focus:border-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isAddingQuick}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-sky-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      {isAddingQuick ? '...' : 'Save'}
                    </button>
                  </form>
                  {quickError && <p className="mt-1 text-[11px] text-red-100">{quickError}</p>}
                </div>
              </div>
            </div>

            {/* COLUMN .03 */}
            <div className="relative pt-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-white">Functions</h3>
              </div>
              <svg className="h-8 w-full overflow-visible" viewBox="0 0 300 32" fill="none">
                <path
                  d="M 0 30 L 250 30 L 285 2"
                  stroke="rgba(255,255,255,0.65)"
                  strokeWidth="1.2"
                />
                <circle cx="285" cy="2" r="3" fill="#FFFFFF" />
              </svg>
              <div className="mt-4 flex items-start gap-4 border-l border-white/45 pl-4">
                <span className="font-mono text-xs font-bold text-white/80">.03</span>
                <div>
                  <p className="text-xs leading-relaxed text-white/95">
                    Executes validated backend tools (<code className="font-mono">create_task</code>
                    , <code className="font-mono">complete_task</code>,{' '}
                    <code className="font-mono">retrieve_progress</code>) with full activity logs.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('activity')}
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white underline decoration-white/60 underline-offset-4 hover:decoration-white"
                  >
                    <span>Inspect Tool Activity Log</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
