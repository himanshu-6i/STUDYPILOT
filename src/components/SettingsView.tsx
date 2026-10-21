import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, ShieldCheck, Database, Cpu } from 'lucide-react';
import type { HealthStatusDTO } from '../lib/api.ts';

interface SettingsViewProps {
  health: HealthStatusDTO | null;
  maxIterations: number;
  onMaxIterationsChange: (val: number) => void;
  onRefreshHealth: () => Promise<void>;
}

export function SettingsView({
  health,
  maxIterations,
  onMaxIterationsChange,
  onRefreshHealth,
}: SettingsViewProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleCheckHealth = async () => {
    setRefreshing(true);
    try {
      await onRefreshHealth();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="pointer-events-auto flex min-h-[80vh] flex-col justify-between py-10">
      {/* Top Editorial Header */}
      <div className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12">
        <div className="flex items-center gap-3 pb-2 lg:col-span-3">
          <span className="text-xs font-semibold tracking-wider text-white/90 uppercase">
            Advantages &amp; Setup
          </span>
          <span className="h-px w-12 bg-white/60" />
        </div>

        <div className="lg:col-span-6">
          <h2 className="font-display text-3xl leading-[1.1] font-bold tracking-tight text-white drop-shadow-sm sm:text-5xl">
            System Architecture
            <br />
            &amp; Alexa+ Simulation
          </h2>
          <p className="mt-2.5 max-w-xl text-xs leading-relaxed text-white/90">
            Live backend telemetry, model provider adapter status, bounded tool-call loop controls,
            and Amazon Developer Hackathon 2026 compliance disclosures.
          </p>
        </div>

        <div className="flex justify-end lg:col-span-3">
          <button
            type="button"
            onClick={handleCheckHealth}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Ping /api/health</span>
          </button>
        </div>
      </div>

      {/* 3-Column Architectural Grid (.01 / .02 / .03) matching Home & Video 00:03 */}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* .01 Live Backend Health & SQLite */}
        <div className="rounded-[28px] border border-white/45 bg-white/20 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-white/85">.01</span>
            <Database className="h-4 w-4 text-white" />
          </div>

          <h3 className="mt-2 font-display text-2xl font-bold text-white">SQLite &amp; API</h3>

          <svg className="my-2.5 h-5 w-full overflow-visible" viewBox="0 0 260 20" fill="none">
            <path
              d="M 0 18 L 220 18 L 248 2"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="1.2"
            />
            <circle cx="248" cy="2" r="2.5" fill="#FFFFFF" />
          </svg>

          <dl className="mt-3 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-white/25 pb-2">
              <dt className="text-white/80">Service Status</dt>
              <dd className="inline-flex items-center gap-1 font-mono font-bold text-emerald-200">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{health?.status ?? 'healthy'}</span>
              </dd>
            </div>
            <div className="flex items-center justify-between border-b border-white/25 pb-2">
              <dt className="text-white/80">Database Engine</dt>
              <dd className="font-mono font-bold text-white">
                {health?.database ?? 'sqlite_connected'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-white/80">Persisted Records</dt>
              <dd className="font-mono font-bold text-white">{health?.tasks_count ?? 0} tasks</dd>
            </div>
          </dl>
        </div>

        {/* .02 Bounded Agent Tool Loop */}
        <div className="rounded-[28px] border border-white/45 bg-white/20 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-white/85">.02</span>
            <Cpu className="h-4 w-4 text-white" />
          </div>

          <h3 className="mt-2 font-display text-2xl font-bold text-white">Bounded Loop</h3>

          <svg className="my-2.5 h-5 w-full overflow-visible" viewBox="0 0 260 20" fill="none">
            <path
              d="M 0 18 L 220 18 L 248 2"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="1.2"
            />
            <circle cx="248" cy="2" r="2.5" fill="#FFFFFF" />
          </svg>

          <p className="mt-2 text-xs leading-relaxed text-white/90">
            Active Provider:{' '}
            <strong className="font-mono">
              {health?.provider ?? 'gemini'} ({health?.model ?? 'gemini-2.5-flash'})
            </strong>
            . Strictly caps tool iterations per turn to guarantee deterministic completion.
          </p>

          <div className="mt-4 rounded-2xl border border-white/35 bg-white/15 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="settings-max-iterations" className="font-semibold text-white">
                Max Tool Iterations
              </label>
              <span className="font-mono font-bold text-white">{maxIterations} iterations</span>
            </div>
            <input
              id="settings-max-iterations"
              type="range"
              min={1}
              max={10}
              value={maxIterations}
              onChange={(e) => onMaxIterationsChange(Number(e.target.value))}
              className="mt-2 w-full accent-white"
            />
          </div>
        </div>

        {/* .03 Hackathon & Alexa+ Simulated Track */}
        <div className="rounded-[28px] border border-white/45 bg-white/20 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-white/85">.03</span>
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>

          <h3 className="mt-2 font-display text-2xl font-bold text-white">Alexa+ Track</h3>

          <svg className="my-2.5 h-5 w-full overflow-visible" viewBox="0 0 260 20" fill="none">
            <path
              d="M 0 18 L 220 18 L 248 2"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth="1.2"
            />
            <circle cx="248" cy="2" r="2.5" fill="#FFFFFF" />
          </svg>

          <p className="mt-2 text-xs leading-relaxed text-white/95">
            Independent browser-based simulation of an intelligent, stateful Alexa+-style assistant
            built for the <strong>Amazon Developer Hackathon 2026</strong>. Not an official Amazon
            product.
          </p>
          <p className="mt-2.5 font-mono text-[11px] text-white/80">
            Includes Node.js/SQLite live runtime + Python FastAPI/SQLAlchemy reference service in{' '}
            <code>/backend</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
