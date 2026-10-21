import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import type { AgentActivityRecord } from '../lib/validation.ts';

interface ActivityViewProps {
  activity: AgentActivityRecord[];
  onRefreshActivity: () => Promise<void>;
}

export function ActivityView({ activity, onRefreshActivity }: ActivityViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filtered = activity.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshActivity();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="pointer-events-auto flex min-h-[80vh] flex-col justify-between py-10">
      {/* Top Editorial Header */}
      <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
        <div className="flex items-center gap-3 pb-2 lg:col-span-3">
          <span className="text-xs font-semibold tracking-wider text-white/90 uppercase">
            Activity
          </span>
          <span className="h-px w-12 bg-white/60" />
        </div>

        <div className="lg:col-span-5">
          <h2 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl">
            Verified Backend
            <br />
            Tool Activity Log
          </h2>
          <p className="mt-2.5 text-xs text-white/90">
            Real-time audit trail of validated backend tool executions (
            <code className="font-mono">create_task</code>,{' '}
            <code className="font-mono">complete_task</code>,{' '}
            <code className="font-mono">retrieve_progress</code>). Secrets are automatically
            redacted.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2.5 lg:col-span-4">
          <div className="flex items-center gap-1 rounded-xl border border-white/35 bg-white/18 p-1 backdrop-blur-md">
            {(['all', 'success', 'error'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-white text-slate-900'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Aero-Glass Tool Execution Cards with .01 / .02 / .03 Leader Lines */}
      {filtered.length === 0 ? (
        <div className="my-8 rounded-3xl border border-white/40 bg-white/18 p-10 text-center text-white backdrop-blur-xl">
          <Terminal className="mx-auto h-7 w-7 text-white/80" />
          <p className="mt-2 text-sm font-bold">No agent tool executions recorded for this filter.</p>
          <p className="mt-1 text-xs text-white/80">
            Trigger a study plan or task action to see verified SQLite tool calls here.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 9).map((record, idx) => {
            const isSuccess = record.status === 'success';
            const numStr = `.${String(idx + 1).padStart(2, '0')}`;

            return (
              <div
                key={record.id}
                data-testid={`activity-row-${record.id}`}
                className="flex flex-col justify-between rounded-[26px] border border-white/45 bg-white/20 p-5 text-white shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-white/85">{numStr}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/25 px-2.5 py-0.5 font-mono text-[11px] font-bold text-white">
                      {isSuccess ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-red-300" />
                      )}
                      <span>{record.tool_name}</span>
                    </span>
                  </div>

                  {/* Angled architectural white connector line */}
                  <svg className="my-2.5 h-4 w-full overflow-visible" viewBox="0 0 260 16" fill="none">
                    <path
                      d="M 0 14 L 225 14 L 250 2"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth="1.2"
                    />
                    <circle cx="250" cy="2" r="2.5" fill="#FFFFFF" />
                  </svg>

                  <p className="text-xs leading-relaxed font-semibold text-white">
                    {record.action_summary}
                  </p>

                  {record.arguments_json && record.arguments_json !== '{}' && (
                    <pre className="mt-2.5 overflow-x-auto rounded-xl border border-white/30 bg-slate-900/25 p-2.5 font-mono text-[10px] text-white/90">
                      {record.arguments_json}
                    </pre>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/30 pt-2.5 font-mono text-[10px] text-white/80">
                  <span>Session: {record.conversation_id.slice(0, 14)}</span>
                  <time dateTime={record.created_at}>
                    {new Date(record.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
