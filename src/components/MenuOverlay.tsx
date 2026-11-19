import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const SVGPlay = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const SVGShield = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const SVGZap = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const SVGTarget = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const languages = [
  { word: 'LOOP', lang: 'English' },
  { word: 'BOUCLE', lang: 'French' },
  { word: 'BUCLE', lang: 'Spanish' },
  { word: 'ПЕТЛЯ', lang: 'Russian' },
  { word: '循环', lang: 'Chinese' },
  { word: 'ループ', lang: 'Japanese' },
  { word: '루프', lang: 'Korean' },
  { word: 'CICLO', lang: 'Italian' },
  { word: 'आवर्त', lang: 'Sanskrit' },
  { word: 'पाश', lang: 'Hindi' },
  { word: 'ବଳୟ', lang: 'Odia' },
  { word: 'পাক', lang: 'Assamese' },
];

interface MenuOverlayProps {
  onStart: (level?: number) => void;
  maxLevelReached: number;
}

export const MenuOverlay: React.FC<MenuOverlayProps> = ({ onStart, maxLevelReached }) => {
  const [currentLangIndex, setCurrentLangIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentLangIndex((prev) => {
        let next = Math.floor(Math.random() * languages.length);
        while (next === prev) next = Math.floor(Math.random() * languages.length);
        return next;
      });
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-[500] bg-[#050505]/75 backdrop-blur-xl overflow-y-auto overflow-x-hidden">
      {/* Background Atmosphere */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[40vw] h-[40vw] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[20%] right-[10%] w-[30vw] h-[30vw] bg-fuchsia-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="min-h-full flex items-center justify-center p-6 md:p-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl w-full flex flex-col items-center gap-10 relative z-10 py-8"
        >
          {/* Title Block */}
          <div className="text-center space-y-4 px-4 w-full">
            <div className="text-xs font-bold text-cyan-400 tracking-[0.35em] uppercase">
              Wave-Particle Orbital Puzzle
            </div>
            <h1 className="text-[clamp(2rem,8vw,5rem)] font-thin tracking-tighter text-white/95 leading-none flex flex-col sm:flex-row justify-center items-center gap-x-4 gap-y-2">
              <span>SINGULARITY</span>
              <span className="inline-flex justify-center items-center min-w-[6.5ch] h-[1.15em]">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={languages[currentLangIndex].word}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    className="font-black text-cyan-400 inline-block text-center"
                  >
                    {languages[currentLangIndex].word}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm font-medium tracking-wider max-w-lg mx-auto leading-relaxed px-4">
              Slingshot across 40 sectors spanning four cosmic epochs. Balance momentum, phase state, and core heat to unlock the Eye.
            </p>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onStart(maxLevelReached > 1 ? maxLevelReached : 1)}
              className="relative group p-[2px] rounded-full overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500 animate-[spin_4s_linear_infinite] opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative bg-[#050505] rounded-full px-8 py-4 sm:px-10 sm:py-5 flex items-center gap-3 border border-white/10">
                <SVGZap className="w-5 h-5 text-cyan-400" />
                <span className="text-white text-sm font-black tracking-[0.2em] uppercase whitespace-nowrap">
                  {maxLevelReached > 1 ? `Resume Sector ${String(maxLevelReached).padStart(2, '0')}` : 'Start Mission'}
                </span>
                <SVGTarget className="w-5 h-5 text-fuchsia-400 opacity-70 group-hover:opacity-100 transition-opacity" />
              </div>
            </motion.button>

            {maxLevelReached > 1 && (
              <button
                onClick={() => onStart(1)}
                className="px-6 py-4 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-bold tracking-[0.18em] uppercase transition-colors cursor-pointer"
              >
                Replay Sector 01
              </button>
            )}
          </div>

          {/* How to Play Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
            <div className="bg-white/[0.03] border border-white/10 p-6 sm:p-8 rounded-3xl backdrop-blur-md">
              <h2 className="text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <SVGPlay className="w-4 h-4" /> Mechanics & Objectives
              </h2>
              <ul className="space-y-3.5 text-xs text-zinc-300 leading-relaxed">
                <li className="flex gap-3">
                  <span className="text-white font-bold shrink-0">LAUNCH:</span>
                  <span>Drag anywhere to aim and release to fire. Drag again mid-flight to course-correct (+12% heat).</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-white font-bold shrink-0">PHASE SHIFT:</span>
                  <span>Press SPACE or Sync to swap states. Particle mode stays cool; Wave mode phases through Asteroids & Nebulas while building heat.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-white font-bold shrink-0">EXTRACTION:</span>
                  <span>Collect golden stardust and cyan Data Fragments to fill the quota in the top center and unlock the Eye.</span>
                </li>
              </ul>
            </div>

            <div className="bg-white/[0.03] border border-white/10 p-6 sm:p-8 rounded-3xl backdrop-blur-md">
              <h2 className="text-fuchsia-400 text-xs font-black uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <SVGShield className="w-4 h-4" /> Hazards & Scoring
              </h2>
              <ul className="space-y-3.5 text-xs text-zinc-300 leading-relaxed">
                <li className="flex gap-3">
                  <span className="text-white font-bold shrink-0">SYNC TIMER:</span>
                  <span>You have 60 seconds per sector. If the countdown hits zero, synchronization fails.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-white font-bold shrink-0">THERMAL LOAD:</span>
                  <span>Staying in Wave mode, bouncing off planets, or correcting mid-flight builds heat. Pass through cyan Cold Sinks to cool down.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-white font-bold shrink-0">BONUSES:</span>
                  <span>Enter the unlocked Eye at high velocity with fewer launches and collect Data Fragments (+0.5× each) for top scores.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Epoch Timeline */}
          <div className="w-full max-w-3xl border-y border-white/10 py-4 sm:py-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-2">
              {[
                { name: 'Classical', range: '01–10', desc: 'Gravity & Portals' },
                { name: 'Quantum', range: '11–20', desc: 'Asteroids & Fields' },
                { name: 'Relativity', range: '21–30', desc: 'Deep Wells & Nebulas' },
                { name: 'Thermal', range: '31–40', desc: 'Heat & Cold Sinks' },
              ].map((epoch, i) => (
                <div key={i} className="flex flex-col items-center text-center">
                  <div className="text-[11px] font-mono text-zinc-500 tabular-nums">{epoch.range}</div>
                  <div className="text-xs font-black text-zinc-200 uppercase tracking-widest mt-0.5">{epoch.name}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{epoch.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Control Footer */}
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10 text-[11px] font-bold text-zinc-500 uppercase tracking-[0.2em] px-4 text-center">
            <span>Drag: Aim & Course-Correct</span>
            <span>Space: Phase Shift</span>
            <span>R: Reset Sector</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
