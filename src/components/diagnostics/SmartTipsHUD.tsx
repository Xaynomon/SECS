import React, { useState } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Flame,
} from 'lucide-react';
import { useCircuitStore } from '../../store/useCircuitStore';
import { runCircuitDiagnostics } from '../../utils/diagnostics';
import { DiagnosticTip } from '../../types/circuit';

export const SmartTipsHUD: React.FC = () => {
  const {
    theme,
    components,
    wires,
    showSmartTips,
    simulationMode,
    simulationStatus,
    toggleInstrument,
    selectComponent,
    setHighlightedComponent,
    viewport,
    setViewport,
    latchedDiagnostics,
    dismissDiagnostic,
    clearLatchedDiagnostics,
  } = useCircuitStore();
  const [minimized, setMinimized] = useState(false);

  if (!showSmartTips) return null;

  const isDark = theme === 'dark';
  const isSimRunning = simulationStatus === 'running';
  const activeTips = runCircuitDiagnostics(components, wires, simulationMode, isSimRunning);

  // Merge active tips with latched diagnostics (to prevent flickering on pulsing signals)
  const latchedList = Object.values(latchedDiagnostics);
  const combinedTips: DiagnosticTip[] = [...latchedList];

  for (const tip of activeTips) {
    if (!combinedTips.some((t) => t.id === tip.id || (t.componentId && t.componentId === tip.componentId))) {
      combinedTips.push(tip);
    }
  }

  // Filter out 'all-clear' if there are active or latched issues
  const finalTips = combinedTips.length > 1 ? combinedTips.filter((t) => t.id !== 'all-clear') : combinedTips;

  const criticalCount = finalTips.filter((t) => t.severity === 'critical' || t.type === 'error').length;
  const warningCount = finalTips.filter((t) => t.severity === 'warning' || t.type === 'warning').length;
  const hasLatched = Object.keys(latchedDiagnostics).length > 0;

  const statusBorder = isDark
    ? criticalCount > 0
      ? 'border-rose-500/60 bg-slate-900/95 text-slate-100 shadow-rose-950/40'
      : warningCount > 0
      ? 'border-amber-500/60 bg-slate-900/95 text-slate-100 shadow-amber-950/40'
      : 'border-slate-800 bg-slate-900/95 text-slate-200'
    : criticalCount > 0
    ? 'border-rose-400 bg-white/95 text-slate-900 shadow-rose-200'
    : warningCount > 0
    ? 'border-amber-400 bg-white/95 text-slate-900 shadow-amber-200'
    : 'border-slate-200 bg-white/95 text-slate-800';

  const handleTipClick = (tip: DiagnosticTip) => {
    if (!tip.componentId) return;
    selectComponent(tip.componentId);
    setHighlightedComponent(tip.componentId);

    // Smoothly pan viewport toward affected component
    const comp = components.find((c) => c.id === tip.componentId);
    if (comp) {
      const targetPanX = Math.round(window.innerWidth / 2 - comp.x * viewport.zoom - 100);
      const targetPanY = Math.round(window.innerHeight / 2 - comp.y * viewport.zoom);
      setViewport({ panX: targetPanX, panY: targetPanY });
    }

    // Auto-clear highlight beacon after 4 seconds
    setTimeout(() => {
      setHighlightedComponent(null);
    }, 4000);
  };

  return (
    <div className="absolute bottom-4 right-4 z-30 max-w-sm w-96 select-none transition-all duration-200">
      <div className={`rounded-xl border shadow-2xl backdrop-blur-md overflow-hidden ${statusBorder}`}>
        {/* HUD Header */}
        <div
          className={`px-3 py-2 flex items-center justify-between border-b ${
            isDark ? 'border-white/10 bg-black/25' : 'border-black/5 bg-slate-100/70'
          }`}
        >
          <div className="flex items-center gap-2">
            {criticalCount > 0 ? (
              <Flame className="w-4 h-4 text-rose-500 shrink-0 animate-bounce" />
            ) : warningCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            ) : (
              <Lightbulb className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            <span className="font-bold text-xs tracking-wide">
              Smart Diagnostics & Assistant
            </span>
            {(criticalCount > 0 || warningCount > 0) && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  criticalCount > 0
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {criticalCount + warningCount} Issue{criticalCount + warningCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {hasLatched && (
              <button
                onClick={clearLatchedDiagnostics}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                }`}
                title="Dismiss all latched diagnostics"
              >
                Dismiss All
              </button>
            )}
            <button
              onClick={() => setMinimized(!minimized)}
              className={`p-1 rounded transition ${
                isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-800'
              }`}
              title={minimized ? 'Expand Tips' : 'Minimize Tips'}
            >
              {minimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => toggleInstrument('smartTips')}
              className={`p-1 rounded transition ${
                isDark ? 'hover:bg-white/10 text-white/70 hover:text-white' : 'hover:bg-black/5 text-slate-500 hover:text-slate-800'
              }`}
              title="Close Tips Panel"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tips Content */}
        {!minimized && (
          <div className="p-2.5 max-h-64 overflow-y-auto space-y-2 text-xs">
            {finalTips.map((tip) => {
              const isCritical = tip.severity === 'critical' || tip.type === 'error';
              const isWarning = tip.severity === 'warning' || tip.type === 'warning';
              const isSuccess = tip.type === 'success';
              const isLatched = Boolean(latchedDiagnostics[tip.id]);

              const itemBg = isDark
                ? isCritical
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-100 hover:border-rose-400'
                  : isWarning
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-100 hover:border-amber-400'
                  : isSuccess
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-100'
                  : 'bg-slate-800/60 border-slate-700 text-slate-200 hover:border-sky-400'
                : isCritical
                ? 'bg-rose-50 border-rose-300 text-rose-950 hover:border-rose-500'
                : isWarning
                ? 'bg-amber-50 border-amber-300 text-amber-950 hover:border-amber-500'
                : isSuccess
                ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-sky-400';

              return (
                <div
                  key={tip.id}
                  onClick={() => handleTipClick(tip)}
                  className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition relative group ${itemBg} ${
                    tip.componentId ? 'cursor-pointer shadow-sm hover:shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 font-bold text-[11px] leading-tight">
                      {isCritical && <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0 animate-pulse" />}
                      {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                      {!isCritical && !isWarning && !isSuccess && (
                        <Lightbulb className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      )}
                      <span>{tip.title}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {tip.peakValue && (
                        <span className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {tip.peakValue}
                        </span>
                      )}
                      {isCritical && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-rose-500 text-white shrink-0">
                          CRITICAL
                        </span>
                      )}
                      {isWarning && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                          WARNING
                        </span>
                      )}
                      {isLatched && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissDiagnostic(tip.id);
                          }}
                          className="opacity-60 hover:opacity-100 p-0.5 rounded hover:bg-black/20 text-current transition"
                          title="Dismiss this alert"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-[10.5px] opacity-90 leading-relaxed font-sans">{tip.message}</div>

                  {tip.actionLabel && (
                    <div className="flex justify-end pt-0.5">
                      <span className="text-[9.5px] font-bold text-sky-400 hover:underline flex items-center gap-1">
                        👉 {tip.actionLabel}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
