import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Terminal,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ToolExecutionOutcomeDTO } from '../lib/api.ts';

export interface UIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolExecutions?: ToolExecutionOutcomeDTO[];
  provider?: string;
  model?: string;
  iterationsUsed?: number;
}

interface AgentChatPanelProps {
  conversationId: string;
  messages: UIMessage[];
  isSending: boolean;
  chatError: string | null;
  maxIterations: number;
  onMaxIterationsChange: (val: number) => void;
  isListeningVoice: boolean;
  isSpeakingVoice: boolean;
  voiceAutoReadout: boolean;
  onToggleVoiceAutoReadout: () => void;
  onToggleVoiceMic: () => void;
  onSpeakText: (text: string) => void;
  onStopSpeakingVoice: () => void;
  onSendMessage: (message: string) => Promise<void>;
  onRetryLastMessage: () => Promise<void>;
  onResetConversation: () => Promise<void>;
}

const SUGGESTED_PROMPTS = [
  {
    label: 'Friday 3 Physics + 1 Chemistry Plan',
    prompt:
      'I have three physics topics and one chemistry assignment to finish by Friday. Create a realistic study plan, prioritize everything, and help me track my progress.',
  },
  {
    label: 'Check My Study Progress',
    prompt: 'What is my current study progress and which high-priority tasks are still pending?',
  },
  {
    label: 'Complete Kinematics Task',
    prompt:
      'I just finished Physics Topic 1: Kinematics & Projectile Motion. Mark it completed and adjust my plan.',
  },
];

export function AgentChatPanel({
  conversationId,
  messages,
  isSending,
  chatError,
  maxIterations,
  onMaxIterationsChange,
  isListeningVoice,
  isSpeakingVoice,
  voiceAutoReadout,
  onToggleVoiceAutoReadout,
  onToggleVoiceMic,
  onSpeakText,
  onStopSpeakingVoice,
  onSendMessage,
  onRetryLastMessage,
  onResetConversation,
}: AgentChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;
    setInputValue('');
    await onSendMessage(trimmed);
  };

  return (
    <aside
      aria-label="StudyPilot AI Agent Chat"
      className="flex h-full flex-col bg-white text-slate-900"
    >
      {/* Header sub-bar with Alexa+ Voice Readout Toggle */}
      <div className="flex items-center justify-between border-b border-slate-200/80 px-5 py-3">
        <div>
          <h2 className="font-display text-sm font-bold tracking-tight text-slate-900">
            Alexa+ Voice &amp; Chat Co-Pilot
          </h2>
          <p className="font-mono text-[11px] text-slate-500">
            Session: {conversationId.slice(0, 18)}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleVoiceAutoReadout}
            aria-label={voiceAutoReadout ? 'Disable Alexa+ voice readout' : 'Enable Alexa+ voice readout'}
            title={voiceAutoReadout ? 'Alexa+ Voice Output: ON' : 'Alexa+ Voice Output: OFF'}
            className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
              voiceAutoReadout
                ? 'border-sky-200 bg-sky-50 text-sky-700'
                : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {voiceAutoReadout ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-sky-600" />
                <span>TTS ON</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5" />
                <span>TTS OFF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowConfig((s) => !s)}
            aria-label="Configure tool loop iterations"
            title="Configure tool loop iterations"
            className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onResetConversation}
            aria-label="Clear conversation history"
            title="Clear conversation history"
            className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Collapsible Bounded Tool Iteration Setting */}
      {showConfig && (
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-xs">
          <div className="flex items-center justify-between">
            <label htmlFor="max-iterations-slider" className="font-medium text-slate-700">
              Max Tool Call Iterations
            </label>
            <span className="font-mono font-bold text-sky-600">{maxIterations} steps</span>
          </div>
          <input
            id="max-iterations-slider"
            type="range"
            min={1}
            max={10}
            value={maxIterations}
            onChange={(e) => onMaxIterationsChange(Number(e.target.value))}
            className="mt-1.5 w-full accent-sky-500"
          />
        </div>
      )}

      {/* Active Alexa+ Voice Status Banner */}
      {(isListeningVoice || isSpeakingVoice) && (
        <div className="flex items-center justify-between border-b border-sky-200 bg-sky-50 px-5 py-2 text-xs text-sky-900">
          <div className="flex items-center gap-2 font-semibold">
            <span className="h-2 w-2 animate-ping rounded-full bg-sky-500" />
            <span>
              {isListeningVoice
                ? 'Alexa+ Simulation Listening to Mic...'
                : 'Alexa+ Speaking Response (3D Core Pulsing)...'}
            </span>
          </div>
          {isSpeakingVoice && (
            <button
              type="button"
              onClick={onStopSpeakingVoice}
              className="rounded bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-sky-500"
            >
              Stop Voice
            </button>
          )}
        </div>
      )}

      {/* Message Stream */}
      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-3.5 overflow-y-auto px-5 py-4"
        role="log"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4">
              <p className="font-mono text-[11px] font-semibold tracking-wider text-sky-600 uppercase">
                Alexa+ Simulated Voice &amp; Tool Agent
              </p>
              <h3 className="mt-1 font-display text-base font-bold text-slate-900">
                Speak or type your study objective
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                StudyPilot AI breaks goals into prioritized tasks, writes directly to SQLite using
                validated tools, and speaks back while pulsing the 3D Aero-Glass sculpture.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Try a Verified Multi-Step Workflow
              </p>
              {SUGGESTED_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={isSending}
                  onClick={() => onSendMessage(item.prompt)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs text-slate-700 shadow-xs transition-all hover:border-sky-400 hover:bg-sky-50/40 disabled:opacity-50"
                >
                  <span className="block font-semibold text-slate-900">{item.label}</span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] text-slate-500">
                    &ldquo;{item.prompt}&rdquo;
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'border border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Verified Backend Tool Execution Trace */}
                {msg.toolExecutions && msg.toolExecutions.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-2.5">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-wider text-sky-600 uppercase">
                      <Terminal className="h-3 w-3" />
                      <span>Verified SQLite Tool Calls ({msg.toolExecutions.length})</span>
                    </div>
                    {msg.toolExecutions.map((exec, idx) => (
                      <div
                        key={`${msg.id}-tool-${idx}`}
                        className="flex items-start gap-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1.5 font-mono text-[11px]"
                      >
                        {exec.status === 'success' ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-900">{exec.tool_name}</span>
                          <p className="truncate text-[10px] text-slate-500">{exec.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-1.5 font-mono text-[10px] text-slate-400">
                    <span>
                      {msg.provider ?? 'agent'} · {msg.model ?? 'tool-loop'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSpeakText(msg.content)}
                      className="inline-flex items-center gap-1 font-sans font-semibold text-sky-600 hover:underline"
                    >
                      <Volume2 className="h-3 w-3" />
                      <span>Speak Aloud</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-center gap-2.5 rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 py-2.5 text-xs text-sky-900">
            <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
            <span>Executing validated agent tools &amp; updating SQLite...</span>
          </div>
        )}

        {chatError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div className="flex-1">
                <p className="font-semibold">Agent Execution Error</p>
                <p className="mt-0.5 text-[11px] text-red-700">{chatError}</p>
                <button
                  type="button"
                  onClick={onRetryLastMessage}
                  className="mt-2 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-500"
                >
                  Retry Request
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Input Form styled after Video 00:06–00:08 + Voice Mic Button */}
      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <label
            htmlFor="agent-chat-input"
            className="block text-xs font-semibold text-slate-700"
          >
            Enter or speak your study command
          </label>
          <button
            type="button"
            onClick={onToggleVoiceMic}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all ${
              isListeningVoice
                ? 'animate-pulse bg-rose-500 text-white'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            {isListeningVoice ? (
              <>
                <MicOff className="h-3 w-3" />
                <span>Stop Mic</span>
              </>
            ) : (
              <>
                <Mic className="h-3 w-3" />
                <span>Voice Mic</span>
              </>
            )}
          </button>
        </div>

        <input
          id="agent-chat-input"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isSending}
          placeholder="e.g., Plan 3 physics topics by Friday..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-900 placeholder-slate-400 transition-colors focus:border-sky-500 focus:bg-white focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isSending || !inputValue.trim()}
          aria-label="Send message to StudyPilot AI"
          className="mt-3 flex w-full items-center justify-between rounded-full bg-gradient-to-r from-[#2B7FFF] to-[#38BDF8] px-5 py-3 text-xs font-bold text-white shadow-md transition-all hover:opacity-95 disabled:opacity-40"
        >
          <span>{isSending ? 'Processing Request...' : 'Send Request'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-3 text-center text-[10px] text-slate-400">
          Validated by StudyPilot AI SQLite Tool Engine · Alexa+ Simulated Experience
        </p>
      </form>
    </aside>
  );
}
