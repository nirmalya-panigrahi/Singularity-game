import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, Epoch } from '../types';
import confetti from 'canvas-confetti';

const SVGRefresh = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

const SVGHome = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SVGVolume = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    {muted ? (
      <>
        <line x1="22" y1="9" x2="16" y2="15" />
        <line x1="16" y1="9" x2="22" y2="15" />
      </>
    ) : (
      <>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </>
    )}
  </svg>
);

const SVGThermometer = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
  </svg>
);

const SVGTrophy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14 text-[#FFD700] mx-auto mb-4">
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
    <path d="M4 22h16" />
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
  </svg>
);

const SVGAlert = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14 text-red-500 mx-auto mb-4">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const SVGTimer = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-cyan-400 shrink-0">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const EPOCH_GROUPS: { name: Epoch; start: number; end: number; accent: string }[] = [
  { name: 'Classical', start: 1, end: 10, accent: 'text-cyan-400' },
  { name: 'Quantum', start: 11, end: 20, accent: 'text-fuchsia-400' },
  { name: 'Relativity', start: 21, end: 30, accent: 'text-amber-400' },
  { name: 'Thermal', start: 31, end: 40, accent: 'text-rose-400' },
];

interface UIOverlayProps {
  gameState: GameState;
  isWaveState: boolean;
  maxLevelReached: number;
  bestScores: Record<number, number>;
  isMuted: boolean;
  onToggleMute: () => void;
  onToggleState: () => void;
  onReset: () => void;
  onNextLevel: () => void;
  onJumpLevel: (level: number) => void;
  onReturnToMenu: () => void;
  getHint?: () => string;
}

export const UIOverlay: React.FC<UIOverlayProps> = ({
  gameState,
  isWaveState,
  maxLevelReached,
  bestScores,
  isMuted,
  onToggleMute,
  onToggleState,
  onReset,
  onNextLevel,
  onJumpLevel,
  onReturnToMenu,
  getHint,
}) => {
  const {
    level,
    epoch,
    status,
    score,
    stardust,
    requiredStardust,
    heat,
    switchCooldown,
    failureReason,
    launches,
    fragmentsCollected,
    totalFragments,
    sessionTimeLeft,
    goalLockedFlashUntil,
  } = gameState;

  const [showHint, setShowHint] = useState(false);
  const [showLevelDrawer, setShowLevelDrawer] = useState(false);
  const hintText = getHint ? getHint() : '';

  // Trigger confetti on win
  useEffect(() => {
    if (status === 'won') {
      const duration = 2500;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 300 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 40 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [status]);

  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.ceil(seconds));
    return s.toString().padStart(2, '0');
  };

  const quotaMet = stardust >= requiredStardust;
  const lockedAlert = Boolean(goalLockedFlashUntil && Date.now() < goalLockedFlashUntil);
  const bestForLevel = bestScores[level] || 0;

  return (
    <div
      className={`absolute inset-0 pointer-events-none flex flex-col font-mono text-[#f0f0f0] select-none p-3 sm:p-6 lg:p-8 transition-colors duration-700 ${
        status === 'lost' ? 'bg-red-950/30' : ''
      }`}
    >
      {/* Top Header Bar */}
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full flex flex-wrap sm:flex-nowrap justify-between items-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-2.5 sm:px-5 sm:py-3 pointer-events-auto shadow-[0_8px_32px_0_rgba(0,0,0,0.75)] relative z-[500] gap-3"
      >
        {/* Left: Sector Button & Epoch */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowLevelDrawer((v) => !v)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer min-h-[40px]"
            title="Select Sector (1–40)"
          >
            <span className="text-[#00F0FF] text-lg sm:text-xl font-black italic tabular-nums">
              {String(level).padStart(2, '0')}
            </span>
            <span className="text-zinc-500">/</span>
            <span className="text-xs font-bold text-zinc-200 uppercase tracking-wider">{epoch}</span>
          </button>
        </div>

        {/* Center: Stardust Quota & Score */}
        <div className="flex flex-col items-center gap-1 order-last sm:order-none w-full sm:w-auto">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-wider tabular-nums">
            <span className="text-cyan-400">{score.toLocaleString()} PTS</span>
            <span className="text-zinc-600" aria-hidden="true">·</span>
            <span className="text-fuchsia-400">
              {fragmentsCollected}/{totalFragments} FRAG
            </span>
          </div>
          <div className="flex items-center gap-2.5 w-full max-w-[220px] sm:w-52">
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={`h-full transition-colors ${
                  quotaMet ? 'bg-[#00F0FF] shadow-[0_0_10px_#00F0FF]' : 'bg-[#FFD700] shadow-[0_0_10px_#FFD700]'
                }`}
                animate={{ width: `${Math.min(100, (stardust / requiredStardust) * 100)}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>
            <span
              className={`text-xs font-black tabular-nums shrink-0 ${
                quotaMet ? 'text-[#00F0FF]' : 'text-[#FFD700]'
              }`}
            >
              {Math.floor(stardust)}/{requiredStardust}
            </span>
          </div>
        </div>

        {/* Right: Timer, Heat & Controls */}
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5">
              <SVGTimer />
              <span
                className={`text-base sm:text-lg font-black tabular-nums tracking-tight ${
                  sessionTimeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-cyan-400'
                }`}
              >
                {formatTime(sessionTimeLeft)}s
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
              <SVGThermometer className={`w-3.5 h-3.5 ${heat > 75 ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`} />
              <div className="w-14 sm:w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${heat > 75 ? 'bg-red-500' : heat > 45 ? 'bg-orange-400' : 'bg-cyan-400'}`}
                  animate={{ width: `${Math.min(100, heat)}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <span className={`text-[11px] font-bold tabular-nums w-8 text-right ${heat > 75 ? 'text-red-400' : 'text-zinc-300'}`}>
                {Math.round(heat)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onToggleMute}
              className="p-2.5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
              title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            >
              <SVGVolume muted={isMuted} />
            </button>
            <button
              onClick={onReset}
              className="p-2.5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
              title="Reset Sector (R)"
              aria-label="Reset Sector"
            >
              <SVGRefresh />
            </button>
            <button
              onClick={onReturnToMenu}
              className="p-2.5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors active:scale-95 cursor-pointer"
              title="Main Menu"
              aria-label="Main Menu"
            >
              <SVGHome />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Locked Goal Warning Banner */}
      <AnimatePresence>
        {lockedAlert && status === 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-auto mt-3 px-4 py-1.5 rounded-full bg-red-950/80 border border-red-500/40 text-red-300 text-xs font-bold tracking-wider uppercase z-[450]"
          >
            Eye Locked · Collect {Math.ceil(requiredStardust - stardust)} More Stardust
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Selector Drawer */}
      <AnimatePresence>
        {showLevelDrawer && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-2 bg-[#0a0a0d]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-4 sm:p-6 pointer-events-auto z-[510] max-h-[65vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Select Sector</h3>
                <p className="text-xs text-zinc-400">Unlocked up to Sector {String(maxLevelReached).padStart(2, '0')} · Click any sector to jump</p>
              </div>
              <button
                onClick={() => setShowLevelDrawer(false)}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-zinc-300 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {EPOCH_GROUPS.map((group) => (
                <div key={group.name} className="bg-white/[0.02] border border-white/5 rounded-xl p-3">
                  <div className={`text-xs font-black uppercase tracking-wider mb-2.5 ${group.accent}`}>
                    {group.name} ({group.start}–{group.end})
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: group.end - group.start + 1 }, (_, idx) => group.start + idx).map((lvl) => {
                      const isCurrent = lvl === level;
                      const isCompleted = Boolean(bestScores[lvl]);
                      const isUnlocked = lvl <= maxLevelReached;
                      return (
                        <button
                          key={lvl}
                          onClick={() => {
                            onJumpLevel(lvl);
                            setShowLevelDrawer(false);
                          }}
                          className={`h-9 rounded-lg text-xs font-bold tabular-nums transition-all cursor-pointer border ${
                            isCurrent
                              ? 'bg-cyan-500 text-black border-cyan-300'
                              : isCompleted
                              ? 'bg-white/10 text-[#FFD700] border-[#FFD700]/30 hover:bg-white/20'
                              : isUnlocked
                              ? 'bg-white/5 text-zinc-200 border-white/10 hover:bg-white/15'
                              : 'bg-white/[0.02] text-zinc-500 border-white/5 hover:text-zinc-300 hover:bg-white/10'
                          }`}
                        >
                          {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Win / Loss Modals */}
      <div className="flex-1 flex items-center justify-center pointer-events-none p-4 z-[200]">
        <AnimatePresence mode="wait">
          {status === 'won' && (
            <motion.div
              key="won-modal"
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0b0b10]/90 backdrop-blur-2xl border border-[#FFD700]/35 p-6 sm:p-10 rounded-3xl text-center shadow-[0_0_80px_rgba(255,215,0,0.15)] pointer-events-auto max-w-[92vw] sm:max-w-md w-full"
            >
              <SVGTrophy />
              <h2 className="text-3xl sm:text-4xl font-black mb-1 tracking-tight uppercase text-[#FFD700] italic">
                Stabilized
              </h2>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-6">
                Sector {String(level).padStart(2, '0')} · {epoch}
              </p>

              <div className="text-3xl font-black text-white tabular-nums tracking-tight mb-6">
                {score.toLocaleString()} PTS
              </div>

              <div className="grid grid-cols-3 gap-2 py-3 px-4 rounded-2xl bg-white/[0.04] border border-white/10 mb-6 text-xs tabular-nums">
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase">Launches</div>
                  <div className="font-bold text-white mt-0.5">{launches}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase">Fragments</div>
                  <div className="font-bold text-fuchsia-400 mt-0.5">
                    {fragmentsCollected}/{totalFragments}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-[10px] uppercase">Best</div>
                  <div className="font-bold text-[#FFD700] mt-0.5">
                    {Math.max(score, bestForLevel).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onReset}
                  className="px-5 py-3.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-200 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Replay
                </button>
                <button
                  onClick={onNextLevel}
                  className="flex-1 bg-[#FFD700] hover:bg-[#FFE55C] active:scale-95 text-black font-black py-3.5 rounded-full transition-all text-xs sm:text-sm tracking-[0.25em] uppercase shadow-[0_0_25px_rgba(255,215,0,0.35)] cursor-pointer"
                >
                  {level < 40 ? 'Next Sector' : 'Restart Loop'}
                </button>
              </div>
            </motion.div>
          )}

          {status === 'lost' && (
            <motion.div
              key="lost-modal"
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#12080a]/90 backdrop-blur-2xl border border-red-500/35 p-6 sm:p-10 rounded-3xl text-center shadow-[0_0_80px_rgba(255,0,0,0.18)] pointer-events-auto max-w-[92vw] sm:max-w-md w-full"
            >
              <SVGAlert />
              <h2 className="text-3xl sm:text-4xl font-black mb-2 tracking-tight uppercase italic text-white">
                Breached
              </h2>
              <p className="text-xs sm:text-sm text-red-300 font-bold uppercase tracking-wider leading-relaxed mb-8">
                {failureReason === 'overheated'
                  ? 'Core Overheated (100% Thermal Load)'
                  : failureReason === 'time_out'
                  ? 'Synchronization Window Expired'
                  : failureReason || 'Critical Sector Failure'}
              </p>
              <button
                onClick={onReset}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-full transition-all active:scale-95 text-xs tracking-[0.3em] uppercase shadow-[0_0_25px_rgba(239,68,68,0.4)] cursor-pointer"
              >
                Retry Sector
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Interface */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        className="flex justify-between items-end w-full pointer-events-none mt-auto gap-4"
      >
        {/* Bottom Left: Controls Reminder */}
        <div className="text-left hidden lg:block">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Singularity Loop</div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            {status === 'playing' ? 'Drag to course-correct · Space to shift' : 'Drag to launch · Space to shift'}
          </div>
        </div>

        {/* Bottom Center: Hint Module */}
        <div className="flex flex-col items-center gap-2.5 pointer-events-auto flex-1">
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 12, opacity: 0 }}
                className="bg-[#0a0a0d]/95 border border-white/15 px-4 py-3 rounded-2xl max-w-xs sm:max-w-sm text-center backdrop-blur-xl shadow-2xl"
              >
                <p className="text-xs text-cyan-300 font-medium leading-relaxed">{hintText}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setShowHint(!showHint)}
            className={`px-6 py-2.5 rounded-full border transition-all text-xs font-bold tracking-[0.15em] uppercase cursor-pointer min-h-[40px] ${
              showHint
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-black/60 border-white/15 text-zinc-300 hover:text-white hover:border-white/30'
            }`}
          >
            {showHint ? 'Hide Hint' : 'Hint'}
          </button>
        </div>

        {/* Bottom Right: Phase Shift / Sync Button with Vibrant Color Fill */}
        <div className="pointer-events-auto">
          <button
            disabled={switchCooldown > 0}
            onClick={onToggleState}
            title="Toggle Particle / Wave Mode (SPACE)"
            className={`w-22 h-22 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center relative active:scale-95 transition-transform shadow-2xl overflow-hidden cursor-pointer disabled:cursor-not-allowed ${
              switchCooldown > 0 ? '' : 'hover:scale-105'
            }`}
          >
            {/* Base Dark Glass Surface */}
            <div
              className={`absolute inset-0 transition-colors duration-300 ${
                isWaveState ? 'bg-[#1a051d]' : 'bg-[#04141a]'
              }`}
            />

            {/* Cooldown Color Fill Effect (rises/drains smoothly without grayscale washout) */}
            {switchCooldown > 0 && (
              <div
                className={`absolute bottom-0 left-0 right-0 z-0 transition-all duration-100 ease-linear ${
                  isWaveState
                    ? 'bg-gradient-to-t from-[#FF00FF]/70 to-[#FF00FF]/35'
                    : 'bg-gradient-to-t from-cyan-400/70 to-cyan-500/35'
                }`}
                style={{ height: `${Math.min(100, (switchCooldown / 2.0) * 100)}%` }}
              />
            )}

            {/* Outer Glowing Ring */}
            <div
              className={`absolute inset-1.5 border-2 rounded-full transition-colors duration-300 pointer-events-none ${
                isWaveState
                  ? 'border-[#FF00FF] shadow-[0_0_20px_rgba(255,0,255,0.45)]'
                  : 'border-cyan-400 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
              }`}
            />

            {/* Sync Inner Content */}
            <div className="z-10 text-center">
              <div
                className={`text-xs sm:text-sm font-black italic tracking-widest uppercase transition-colors duration-300 ${
                  isWaveState ? 'text-[#FF66FF]' : 'text-cyan-300'
                }`}
              >
                Sync
              </div>
              <div className="text-[10px] sm:text-xs text-white/80 font-bold uppercase mt-0.5 tabular-nums">
                {switchCooldown > 0 ? `${switchCooldown.toFixed(1)}s` : isWaveState ? 'Wave' : 'Particle'}
              </div>
            </div>
          </button>
        </div>
      </motion.div>
    </div>
  );
};
