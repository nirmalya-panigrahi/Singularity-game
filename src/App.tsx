import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GameEngine } from './game/GameEngine';
import { soundFX } from './game/sound';
import { GameCanvas } from './components/GameCanvas';
import { UIOverlay } from './components/UIOverlay';
import { MenuOverlay } from './components/MenuOverlay';
import { GameState } from './types';

function loadStoredNumber(key: string, fallback: number): number {
  try {
    const val = localStorage.getItem(key);
    const parsed = val ? parseInt(val, 10) : NaN;
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function loadStoredScores(): Record<number, number> {
  try {
    const raw = localStorage.getItem('singularity_best_scores');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function App() {
  const [level, setLevel] = useState(1);
  const [maxLevelReached, setMaxLevelReached] = useState<number>(() =>
    loadStoredNumber('singularity_max_level', 1)
  );
  const [bestScores, setBestScores] = useState<Record<number, number>>(loadStoredScores);
  const [showMenu, setShowMenu] = useState(true);
  const [isMuted, setIsMuted] = useState(() => soundFX.isMuted());
  const engineRef = useRef<GameEngine | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    level: 1,
    epoch: 'Classical',
    heat: 0,
    integrity: 100,
    status: 'preview',
    score: 0,
    timeScale: 1.0,
    stardust: 0,
    requiredStardust: 20,
    optimumScore: 0,
    switchCooldown: 0,
    goalCollected: false,
    launches: 0,
    fragmentsCollected: 0,
    totalFragments: 0,
    levelStartTime: Date.now(),
    sessionTimeLeft: 60,
  });
  const [isWaveState, setIsWaveState] = useState(false);

  // Memoize ambient background particles so they never jump on state polls
  const ambientParticles = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        top: `${((i * 37 + 13) % 97)}%`,
        left: `${((i * 53 + 7) % 97)}%`,
        delay: `${(i * 0.75) % 15}s`,
        opacity: 0.1 + (i % 4) * 0.05,
      })),
    []
  );

  // Initialize engine on level change
  useEffect(() => {
    engineRef.current = new GameEngine(level);
    setGameState({ ...engineRef.current.gameState });
    setIsWaveState(engineRef.current.probe.isWaveState);
  }, [level]);

  // Poll engine state for UI updates & persist wins
  useEffect(() => {
    if (showMenu) return;
    const pollId = setInterval(() => {
      if (!engineRef.current) return;
      const snapshot = engineRef.current.gameState;
      setGameState({ ...snapshot });
      setIsWaveState(engineRef.current.probe.isWaveState);

      if (snapshot.status === 'won') {
        setMaxLevelReached((prev) => {
          const unlocked = Math.min(40, Math.max(prev, snapshot.level + 1));
          if (unlocked !== prev) {
            try {
              localStorage.setItem('singularity_max_level', String(unlocked));
            } catch {
              // Ignore storage errors
            }
          }
          return unlocked;
        });

        setBestScores((prev) => {
          const currentBest = prev[snapshot.level] || 0;
          if (snapshot.score > currentBest) {
            const next = { ...prev, [snapshot.level]: snapshot.score };
            try {
              localStorage.setItem('singularity_best_scores', JSON.stringify(next));
            } catch {
              // Ignore storage errors
            }
            return next;
          }
          return prev;
        });
      }
    }, 50);
    return () => clearInterval(pollId);
  }, [showMenu]);

  const handleToggleState = useCallback(() => {
    engineRef.current?.toggleState();
    if (engineRef.current) {
      setIsWaveState(engineRef.current.probe.isWaveState);
      setGameState({ ...engineRef.current.gameState });
    }
  }, []);

  const handleReset = useCallback(() => {
    engineRef.current?.reset();
    if (engineRef.current) {
      setGameState({ ...engineRef.current.gameState });
      setIsWaveState(engineRef.current.probe.isWaveState);
    }
  }, []);

  const handleNextLevel = useCallback(() => {
    if (level < 40) {
      const nextLvl = level + 1;
      setLevel(nextLvl);
      setMaxLevelReached((prev) => Math.max(prev, nextLvl));
    } else {
      setLevel(1);
    }
  }, [level]);

  const handleJumpLevel = useCallback((l: number) => {
    setLevel(l);
  }, []);

  const handleStartFromMenu = useCallback((targetLevel?: number) => {
    if (typeof targetLevel === 'number') {
      setLevel(targetLevel);
    }
    setShowMenu(false);
  }, []);

  const handleToggleMute = useCallback(() => {
    const nextMuted = !soundFX.isMuted();
    soundFX.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, []);

  const getEngineHint = useCallback(() => {
    return engineRef.current?.getHint() || '';
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showMenu) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleToggleState();
      }
      if (e.code === 'KeyR') {
        handleReset();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMenu, handleToggleState, handleReset]);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-mono antialiased text-[#f0f0f0]">
      <div className="absolute inset-0 game-bg-pattern opacity-10 pointer-events-none" />

      {ambientParticles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            top: p.top,
            left: p.left,
            animationDelay: p.delay,
            opacity: p.opacity,
          }}
        />
      ))}

      <div className="scanline" />

      <GameCanvas
        level={level}
        engineRef={engineRef}
        onWin={handleNextLevel}
        onLoss={() => {}}
      />

      {!showMenu && (
        <UIOverlay
          gameState={gameState}
          isWaveState={isWaveState}
          maxLevelReached={maxLevelReached}
          bestScores={bestScores}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onToggleState={handleToggleState}
          onReset={handleReset}
          onNextLevel={handleNextLevel}
          onJumpLevel={handleJumpLevel}
          onReturnToMenu={() => setShowMenu(true)}
          getHint={getEngineHint}
        />
      )}

      {showMenu && (
        <MenuOverlay onStart={handleStartFromMenu} maxLevelReached={maxLevelReached} />
      )}

      {/* Subtle Edge Frame */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.75)] z-[400]" />
      <div className="absolute inset-0 border border-white/5 pointer-events-none z-[400]" />
    </div>
  );
}
