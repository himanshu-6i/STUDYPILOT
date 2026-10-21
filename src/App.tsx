import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  ArrowRight,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Mic,
  MicOff,
  CheckCircle2,
} from 'lucide-react';
import {
  type StudyTask,
  type CreateTaskInput,
  type AgentActivityRecord,
  type ProgressMetrics,
  calculateProgressMetrics,
  formatStudyPlanMarkdown,
} from './lib/validation.ts';
import { studyPilotApi, type HealthStatusDTO } from './lib/api.ts';
import { OverviewView } from './components/OverviewView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { StudyPlannerView } from './components/StudyPlannerView.tsx';
import { ActivityView } from './components/ActivityView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { AgentChatPanel, type UIMessage } from './components/AgentChatPanel.tsx';
import { TaskModal } from './components/TaskModal.tsx';
import { NeuralOrbScene3D, type CameraPreset } from './components/NeuralOrbScene3D.tsx';

type NavTab = 'overview' | 'planner' | 'tasks' | 'activity' | 'settings';

const NAV_ITEMS: Array<{ id: NavTab; label: string; preset: CameraPreset; sectionId: string }> = [
  { id: 'overview', label: 'Home', preset: 'hero_home', sectionId: 'section-overview' },
  { id: 'planner', label: 'Study Planner', preset: 'planner_focus', sectionId: 'section-planner' },
  { id: 'tasks', label: 'My Tasks', preset: 'architecture_grid', sectionId: 'section-tasks' },
  { id: 'activity', label: 'Activity', preset: 'top_matrix', sectionId: 'section-activity' },
  {
    id: 'settings',
    label: 'Advantages & Setup',
    preset: 'advantages_wide',
    sectionId: 'section-settings',
  },
];

const INTRO_LETTERS = [
  { letter: 'S', word: 'study' },
  { letter: 'P', word: 'pilot' },
  { letter: 'A', word: 'agent' },
  { letter: 'I', word: 'intelligence' },
];

const INITIAL_PROGRESS: ProgressMetrics = {
  total_tasks: 0,
  completed_tasks: 0,
  pending_tasks: 0,
  completion_rate: 0,
  high_priority_pending: 0,
  overdue_or_due_soon: 0,
  total_estimated_minutes_remaining: 0,
  by_subject: [],
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [progress, setProgress] = useState<ProgressMetrics>(INITIAL_PROGRESS);
  const [activity, setActivity] = useState<AgentActivityRecord[]>([]);
  const [health, setHealth] = useState<HealthStatusDTO | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // 3D Aero-Glass Scene & Continuous Scroll Choreography State
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('hero_home');
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [orbitSpeed, setOrbitSpeed] = useState<number>(0.8);
  const [ringExpansion, setRingExpansion] = useState<number>(1.0);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(true);
  const [zenCinemaMode, setZenCinemaMode] = useState<boolean>(false);
  const [isFocusTimerActive, setIsFocusTimerActive] = useState<boolean>(false);

  // Alexa+ Live Voice Assistant State (Mic STT + Voice TTS Readout)
  const [isListeningVoice, setIsListeningVoice] = useState<boolean>(false);
  const [isSpeakingVoice, setIsSpeakingVoice] = useState<boolean>(false);
  const [voiceAutoReadout, setVoiceAutoReadout] = useState<boolean>(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  // Kinetic Typography Intro Overlay (Video 00:09–00:15)
  const [introStep, setIntroStep] = useState<number | null>(null);

  // Conversation & Left Slide-Over White Request Drawer (Video 00:06–00:08)
  const [conversationId] = useState<string>(() => {
    try {
      const saved = window.localStorage.getItem('studypilot_conversation_id');
      if (saved && /^[a-zA-Z0-9_-]{1,80}$/.test(saved)) return saved;
      const fresh = 'alexa_sim_session_01';
      window.localStorage.setItem('studypilot_conversation_id', fresh);
      return fresh;
    } catch {
      return 'alexa_sim_session_01';
    }
  });
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [maxIterations, setMaxIterations] = useState<number>(5);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  // Task Modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastBanner(msg);
    setTimeout(() => {
      setToastBanner((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const stopSpeakingVoice = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore synthesis errors
    }
    setIsSpeakingVoice(false);
  }, []);

  const speakAssistantText = useCallback((text: string) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*#_`>-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(cleanText.slice(0, 420));
      utterance.rate = 1.03;
      utterance.pitch = 1.02;
      utterance.onstart = () => setIsSpeakingVoice(true);
      utterance.onend = () => setIsSpeakingVoice(false);
      utterance.onerror = () => setIsSpeakingVoice(false);
      setIsSpeakingVoice(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeakingVoice(false);
    }
  }, []);

  const loadWorkspaceData = useCallback(async () => {
    try {
      setGlobalError(null);
      const [tasksRes, activityRes, healthRes, convRes] = await Promise.all([
        studyPilotApi.listTasks(),
        studyPilotApi.listActivity(50),
        studyPilotApi.getHealth(),
        studyPilotApi.getConversationHistory(conversationId),
      ]);

      setTasks(tasksRes.tasks);
      setProgress(tasksRes.progress ?? calculateProgressMetrics(tasksRes.tasks));
      setActivity(activityRes.activity);
      setHealth(healthRes);

      if (convRes.messages && convRes.messages.length > 0) {
        const mapped: UIMessage[] = convRes.messages.map((m) => {
          let parsedTools = [];
          try {
            parsedTools = JSON.parse(m.tool_calls_json || '[]');
          } catch {
            parsedTools = [];
          }
          return {
            id: `db-msg-${m.id}`,
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
            toolExecutions:
              Array.isArray(parsedTools) && parsedTools.length > 0 ? parsedTools : undefined,
          };
        });
        setMessages(mapped);
      }
    } catch (err) {
      setGlobalError(
        err instanceof Error ? err.message : 'Unable to connect to StudyPilot AI backend.'
      );
    } finally {
      setLoadingInitial(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  // Continuous Scroll Listener: updates scrollProgress (0..1) and active section as user scrolls
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll));
      setScrollProgress(ratio);

      const viewportMid = window.innerHeight * 0.42;
      for (let i = NAV_ITEMS.length - 1; i >= 0; i--) {
        const item = NAV_ITEMS[i];
        const el = document.getElementById(item.sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= viewportMid) {
            setActiveTab((prev) => (prev !== item.id ? item.id : prev));
            setCameraPreset((prev) => {
              if (item.id === 'overview' && prev === 'architecture_grid') return prev;
              return item.preset;
            });
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Kinetic Typography Intro Timer (Video 00:09–00:15)
  useEffect(() => {
    if (introStep === null) return;
    if (introStep >= INTRO_LETTERS.length) {
      const t = setTimeout(() => setIntroStep(null), 350);
      return () => clearTimeout(t);
    }
    const timer = setTimeout(() => {
      setIntroStep((prev) => (prev !== null ? prev + 1 : null));
    }, 650);
    return () => clearTimeout(timer);
  }, [introStep]);

  const handleCreateOrUpdateTask = async (input: CreateTaskInput) => {
    setGlobalError(null);
    if (editingTask) {
      const res = await studyPilotApi.updateTask(editingTask.id, input);
      setTasks((prev) => prev.map((t) => (t.id === res.task.id ? res.task : t)));
      setProgress(res.progress);
      showToast(`Updated task "${res.task.title}" in SQLite.`);
    } else {
      const res = await studyPilotApi.createTask(input);
      setTasks((prev) => [res.task, ...prev]);
      setProgress(res.progress);
      showToast(`Created task "${res.task.title}" in SQLite.`);
    }
    const actRes = await studyPilotApi.listActivity(50);
    setActivity(actRes.activity);
  };

  const handleToggleTaskStatus = async (task: StudyTask) => {
    try {
      setGlobalError(null);
      const nextStatus = task.status === 'completed' ? 'pending' : 'completed';
      const res = await studyPilotApi.updateTask(task.id, { status: nextStatus });
      setTasks((prev) => prev.map((t) => (t.id === res.task.id ? res.task : t)));
      setProgress(res.progress);
      const actRes = await studyPilotApi.listActivity(50);
      setActivity(actRes.activity);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      setGlobalError(null);
      const res = await studyPilotApi.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setProgress(res.progress);
      const actRes = await studyPilotApi.listActivity(50);
      setActivity(actRes.activity);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to delete task.');
    }
  };

  const handleSendChatMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSendingChat) return;

    setChatError(null);
    setLastFailedPrompt(null);
    setAiDrawerOpen(true);
    stopSpeakingVoice();

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);

    try {
      const res = await studyPilotApi.sendChatMessage({
        message: trimmed,
        conversation_id: conversationId,
        max_iterations: maxIterations,
      });

      const assistantMsg: UIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: new Date().toISOString(),
        toolExecutions: res.tool_executions,
        provider: res.provider,
        model: res.model,
        iterationsUsed: res.iterations_used,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setTasks(res.tasks);
      setProgress(res.progress);
      setActivity(res.activity);

      if (voiceAutoReadout && res.reply) {
        speakAssistantText(res.reply);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to process agent message.';
      setChatError(message);
      setLastFailedPrompt(trimmed);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Alexa+ Live Voice Mic Handler (Web Speech API + Graceful Simulated Fallback)
  const handleToggleVoiceMic = () => {
    if (isListeningVoice) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
      setIsListeningVoice(false);
      return;
    }

    stopSpeakingVoice();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      // Graceful Alexa+ simulated voice prompt when browser SpeechRecognition is unavailable
      setIsListeningVoice(true);
      setAiDrawerOpen(true);
      showToast('Alexa+ Simulated Voice: Listening ("What is my current study progress?")...');
      setTimeout(() => {
        setIsListeningVoice(false);
        handleSendChatMessage(
          'What is my current study progress and which high-priority tasks are still pending?'
        );
      }, 1600);
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListeningVoice(true);
        showToast('Alexa+ Voice Listening... Speak your study goal or command.');
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript;
        setIsListeningVoice(false);
        if (transcript && transcript.trim()) {
          handleSendChatMessage(transcript.trim());
        }
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
        setAiDrawerOpen(true);
        showToast('Microphone unavailable in iframe — executing Alexa+ Simulated Voice Demo.');
        handleSendChatMessage(
          'What is my current study progress and which high-priority tasks are still pending?'
        );
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
      setAiDrawerOpen(true);
    }
  };

  // 1-Click Markdown Study Plan Exporter
  const handleExportStudyPlan = () => {
    const markdown = formatStudyPlanMarkdown(tasks, progress);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'StudyPilot_AI_Study_Plan.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Downloaded StudyPilot_AI_Study_Plan.md from live SQLite tasks.');
  };

  const handleRetryLastMessage = async () => {
    if (!lastFailedPrompt) return;
    setMessages((prev) => prev.slice(0, -1));
    await handleSendChatMessage(lastFailedPrompt);
  };

  const handleResetConversation = async () => {
    try {
      stopSpeakingVoice();
      await studyPilotApi.clearConversationHistory(conversationId);
      setMessages([]);
      setChatError(null);
      setLastFailedPrompt(null);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to clear conversation.');
    }
  };

  const openNewTaskModal = () => {
    setEditingTask(null);
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: StudyTask) => {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  };

  const handleSwitchNavTab = (tab: NavTab) => {
    setActiveTab(tab);
    setZenCinemaMode(false);
    const found = NAV_ITEMS.find((i) => i.id === tab);
    if (found) {
      setCameraPreset(found.preset);
      const el = document.getElementById(found.sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#7E94A8] text-white">
      {/* FULL-VIEWPORT INTERACTIVE 3D AERO-GLASS SCENE (Animates with scroll, Alexa+ voice, and Focus Timer) */}
      <div
        className={`fixed inset-0 z-0 transition-transform duration-700 ease-out ${
          aiDrawerOpen ? 'lg:translate-x-28 lg:scale-[0.96]' : 'translate-x-0 scale-100'
        }`}
      >
        <NeuralOrbScene3D
          tasks={tasks}
          progress={progress}
          isAgentBusy={isSendingChat}
          isVoiceActive={isListeningVoice || isSpeakingVoice}
          isFocusTimerActive={isFocusTimerActive}
          cameraPreset={cameraPreset}
          scrollProgress={scrollProgress}
          orbitSpeed={orbitSpeed}
          ringExpansion={ringExpansion}
          onSelectTaskFrom3D={(task) => openEditTaskModal(task)}
        />
      </div>

      {/* SIGNATURE ARCHITECTURAL WHITE DIAGONAL CORNER CUT AT BOTTOM-LEFT (Video 00:00–00:05) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-0 z-20 h-20 w-20 bg-white sm:h-28 sm:w-28"
        style={{ clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }}
      />

      {/* KINETIC TYPOGRAPHY INTRO OVERLAY (Video 00:09–00:15: White Minimalist S-P-A-I Reveal) */}
      {introStep !== null && (
        <div className="fixed inset-0 z-50 flex flex-col justify-between bg-white p-8 text-slate-950 transition-opacity duration-300 sm:p-12">
          <div className="flex items-start justify-between">
            <p className="font-display text-lg leading-snug font-bold tracking-tight text-slate-900 sm:text-xl">
              Innovation,
              <br />
              Friendly, Stable,
              <br />
              Accessible
            </p>
            <button
              type="button"
              onClick={() => setIntroStep(null)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Skip Intro
            </button>
          </div>

          <div className="my-auto flex items-center justify-center">
            {INTRO_LETTERS[Math.min(introStep, INTRO_LETTERS.length - 1)] && (
              <div className="relative flex items-start">
                <span className="font-display text-[140px] leading-none font-black tracking-tighter text-slate-950 select-none sm:text-[200px]">
                  {INTRO_LETTERS[Math.min(introStep, INTRO_LETTERS.length - 1)].letter}
                </span>
                <span className="mt-6 ml-3 font-sans text-sm font-semibold tracking-wide text-slate-600">
                  {INTRO_LETTERS[Math.min(introStep, INTRO_LETTERS.length - 1)].word}
                </span>
              </div>
            )}
          </div>

          <div className="w-full">
            <div className="h-0.5 w-full overflow-hidden bg-slate-200">
              <div
                className="h-full bg-slate-900 transition-all duration-500"
                style={{
                  width: `${Math.min(100, ((introStep + 1) / INTRO_LETTERS.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SEMANTIC DOM OVERLAY LAYER */}
      <div className="relative z-10 flex min-h-screen flex-col pointer-events-none">
        {/* FIXED TOP BAR MATCHING VIDEO 00:00–00:05 */}
        <header className="pointer-events-auto fixed top-0 right-0 left-0 z-30 flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3 md:flex-nowrap md:px-10 md:pt-5">
          {/* Zone 1: Wordmark */}
          <a
            href="#section-overview"
            onClick={(e) => {
              e.preventDefault();
              handleSwitchNavTab('overview');
            }}
            className="font-display text-lg font-extrabold tracking-tight text-white drop-shadow-sm md:text-xl whitespace-nowrap shrink-0"
          >
            STUDYPILOT
          </a>

          {/* Zone 2: Center Frosted Glass Navigation Bar */}
          <nav
            aria-label="Primary Navigation"
            className="order-3 flex w-full items-center justify-between gap-2 overflow-x-auto rounded-2xl border border-white/35 bg-white/22 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-xl md:order-2 md:w-auto md:justify-center md:gap-7 md:px-8 md:py-3"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSwitchNavTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`transition-all whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'font-bold text-white underline decoration-white decoration-2 underline-offset-4'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Alexa+ Mic + New Study Task + Crisp White "Request ->" Button */}
          <div className="order-2 flex items-center gap-2 shrink-0 md:order-3">
            <button
              type="button"
              onClick={handleToggleVoiceMic}
              aria-label="Alexa+ Voice Assistant Mic"
              title="Speak to StudyPilot AI (Alexa+ Voice Mode)"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold backdrop-blur-xl transition-all whitespace-nowrap shrink-0 ${
                isListeningVoice
                  ? 'animate-pulse border-rose-300 bg-rose-500 text-white'
                  : 'border-white/40 bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              {isListeningVoice ? (
                <>
                  <MicOff className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Listening...</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Alexa+ Voice</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={openNewTaskModal}
              className="flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/20 px-3.5 py-2.5 text-xs font-semibold text-white backdrop-blur-xl transition-colors hover:bg-white/30 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Study Task</span>
            </button>

            <button
              type="button"
              onClick={() => setAiDrawerOpen((v) => !v)}
              className="flex items-center gap-4 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-lg transition-transform hover:scale-[1.02] whitespace-nowrap shrink-0"
            >
              <span>Request</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-900" />
            </button>
          </div>
        </header>

        {/* CONTINUOUS SCROLL MAIN VIEWPORT */}
        <main className="flex-1 px-4 pt-24 pb-28 sm:px-8 md:pt-24">
          {toastBanner && (
            <div
              role="status"
              className="pointer-events-auto fixed top-20 right-6 z-40 flex items-center gap-2 rounded-2xl border border-white/50 bg-slate-900/80 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur-xl"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
              <span>{toastBanner}</span>
            </div>
          )}

          {globalError && (
            <div
              role="alert"
              className="pointer-events-auto mx-auto mb-4 flex max-w-xl items-center justify-between rounded-xl border border-red-300/40 bg-red-950/85 px-4 py-3 text-xs text-red-100 backdrop-blur-md"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-300" />
                <span>{globalError}</span>
              </div>
              <button
                type="button"
                onClick={loadWorkspaceData}
                className="rounded bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/30"
              >
                Retry Connection
              </button>
            </div>
          )}

          {loadingInitial ? (
            <div className="pointer-events-auto mx-auto mt-12 flex max-w-md items-center justify-center gap-2.5 rounded-2xl border border-white/35 bg-white/20 px-6 py-4 text-xs font-medium text-white backdrop-blur-xl">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Initializing 3D Aero-Glass Core &amp; SQLite study state...</span>
            </div>
          ) : (
            !zenCinemaMode && (
              <div className="mx-auto max-w-7xl space-y-24">
                {/* SECTION 01: HOME (Hero Aero-Glass + 85% C-Ring / 25:00 Focus Timer + Alexa+ Voice) */}
                <section id="section-overview" className="scroll-mt-24">
                  <OverviewView
                    tasks={tasks}
                    progress={progress}
                    isAgentBusy={isSendingChat}
                    isListeningVoice={isListeningVoice}
                    isSpeakingVoice={isSpeakingVoice}
                    onToggleVoiceMic={handleToggleVoiceMic}
                    onStopSpeakingVoice={stopSpeakingVoice}
                    onFocusTimerStateChange={setIsFocusTimerActive}
                    onExportStudyPlan={handleExportStudyPlan}
                    cameraPreset={cameraPreset}
                    onChangeCameraPreset={setCameraPreset}
                    onToggleTaskStatus={handleToggleTaskStatus}
                    onCreateTask={handleCreateOrUpdateTask}
                    onEditTask={openEditTaskModal}
                    onDeleteTask={handleDeleteTask}
                    onOpenNewTaskModal={openNewTaskModal}
                    onNavigateTab={handleSwitchNavTab}
                    onSendQuickGoal={handleSendChatMessage}
                    onOpenAiDrawer={() => setAiDrawerOpen(true)}
                  />
                </section>

                {/* SECTION 02: STUDY PLANNER (Aero-Glass Spatial Goal Decomposer & .01/.02/.03 Subject Matrix) */}
                <section
                  id="section-planner"
                  className="scroll-mt-24 border-t border-white/30 pt-6"
                >
                  <StudyPlannerView
                    tasks={tasks}
                    progress={progress}
                    isGeneratingPlan={isSendingChat}
                    onGenerateStudyPlan={handleSendChatMessage}
                    onToggleTaskStatus={handleToggleTaskStatus}
                    onExportStudyPlan={handleExportStudyPlan}
                  />
                </section>

                {/* SECTION 03: MY TASKS (Aero-Glass Persistent SQLite Task Matrix) */}
                <section
                  id="section-tasks"
                  className="scroll-mt-24 border-t border-white/30 pt-6"
                >
                  <TasksView
                    tasks={tasks}
                    onToggleTaskStatus={handleToggleTaskStatus}
                    onEditTask={openEditTaskModal}
                    onDeleteTask={handleDeleteTask}
                    onOpenNewTaskModal={openNewTaskModal}
                  />
                </section>

                {/* SECTION 04: ACTIVITY (Aero-Glass Verified Backend Tool Execution Stream) */}
                <section
                  id="section-activity"
                  className="scroll-mt-24 border-t border-white/30 pt-6"
                >
                  <ActivityView
                    activity={activity}
                    onRefreshActivity={async () => {
                      const res = await studyPilotApi.listActivity(50);
                      setActivity(res.activity);
                    }}
                  />
                </section>

                {/* SECTION 05: ADVANTAGES & SETUP (Aero-Glass System Health, Bounded Loop & Alexa+ Track) */}
                <section
                  id="section-settings"
                  className="scroll-mt-24 border-t border-white/30 pt-6"
                >
                  <SettingsView
                    health={health}
                    maxIterations={maxIterations}
                    onMaxIterationsChange={setMaxIterations}
                    onRefreshHealth={async () => {
                      const h = await studyPilotApi.getHealth();
                      setHealth(h);
                    }}
                  />
                </section>
              </div>
            )
          )}
        </main>

        {/* COLLAPSIBLE BOTTOM 3D AERO-GLASS STAGE DOCK */}
        <div className="pointer-events-auto fixed bottom-3 left-1/2 z-30 w-[92vw] max-w-[860px] -translate-x-1/2">
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setDockCollapsed((v) => !v)}
              className="flex items-center gap-1.5 rounded-t-xl border border-b-0 border-white/35 bg-white/20 px-4 py-1.5 text-[11px] font-semibold text-white backdrop-blur-xl hover:bg-white/30 whitespace-nowrap shrink-0"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 text-white" />
                  <span>3D Aero-Glass Controls</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-white" />
                  <span>Hide 3D Controls</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setIntroStep(0)}
              className="flex items-center gap-1.5 rounded-t-xl border border-b-0 border-white/35 bg-white/25 px-3.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-xl hover:bg-white/35 whitespace-nowrap shrink-0"
            >
              <Play className="h-3 w-3 fill-current" />
              <span>Play S-P-A-I Intro</span>
            </button>
          </div>

          {!dockCollapsed && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/22 px-4 py-2.5 text-white shadow-2xl backdrop-blur-2xl">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-white">3D Angle:</span>
                {(
                  [
                    { id: 'hero_home', label: '01 Hero Glass' },
                    { id: 'planner_focus', label: '02 Planner Caliper' },
                    { id: 'architecture_grid', label: '03 Basics (.01/.02/.03)' },
                    { id: 'top_matrix', label: '04 Top Matrix' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setCameraPreset(cam.id)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      cameraPreset === cam.id
                        ? 'bg-white text-slate-900'
                        : 'bg-white/15 text-white hover:bg-white/25'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 font-mono text-[11px] text-white">
                  <span>Capsule Spread</span>
                  <input
                    type="range"
                    min={0.75}
                    max={1.45}
                    step={0.05}
                    value={ringExpansion}
                    onChange={(e) => setRingExpansion(Number(e.target.value))}
                    className="h-1.5 w-20 accent-white"
                  />
                </label>

                <label className="flex items-center gap-2 font-mono text-[11px] text-white">
                  <span>Rotation</span>
                  <input
                    type="range"
                    min={0}
                    max={2.5}
                    step={0.1}
                    value={orbitSpeed}
                    onChange={(e) => setOrbitSpeed(Number(e.target.value))}
                    className="h-1.5 w-20 accent-white"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setZenCinemaMode((v) => !v)}
                  className="rounded-lg border border-white/40 bg-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/30 whitespace-nowrap shrink-0"
                >
                  {zenCinemaMode ? 'Show Overlay Text' : 'Pure 3D Sculpture'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LEFT-SIDE WHITE CARD SLIDE-OVER DRAWER (Video 00:06–00:08) */}
      {aiDrawerOpen && (
        <div
          className="fixed top-4 bottom-4 left-4 z-40 flex w-[92vw] max-w-[400px] flex-col overflow-hidden rounded-[28px] border border-white bg-white text-slate-900 shadow-[0_30px_90px_rgba(15,23,42,0.38)]"
          role="dialog"
          aria-label="StudyPilot AI Assistant Co-Pilot"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3">
            <span className="font-mono text-[11px] font-bold tracking-wider text-sky-600 uppercase">
              StudyPilot AI Request
            </span>
            <button
              type="button"
              onClick={() => setAiDrawerOpen(false)}
              aria-label="Close AI Assistant Co-Pilot"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-xs transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <AgentChatPanel
              conversationId={conversationId}
              messages={messages}
              isSending={isSendingChat}
              chatError={chatError}
              maxIterations={maxIterations}
              onMaxIterationsChange={setMaxIterations}
              isListeningVoice={isListeningVoice}
              isSpeakingVoice={isSpeakingVoice}
              voiceAutoReadout={voiceAutoReadout}
              onToggleVoiceAutoReadout={() => setVoiceAutoReadout((v) => !v)}
              onToggleVoiceMic={handleToggleVoiceMic}
              onSpeakText={speakAssistantText}
              onStopSpeakingVoice={stopSpeakingVoice}
              onSendMessage={handleSendChatMessage}
              onRetryLastMessage={handleRetryLastMessage}
              onResetConversation={handleResetConversation}
            />
          </div>
        </div>
      )}

      {/* Task Creation & Edit Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setEditingTask(null);
        }}
        onSubmit={handleCreateOrUpdateTask}
        initialTask={editingTask}
      />
    </div>
  );
}
