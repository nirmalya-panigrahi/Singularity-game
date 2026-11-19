import React, { useRef, useEffect, useCallback } from 'react';
import { GameEngine, PHYSICS_WIDTH, PHYSICS_HEIGHT } from '../game/GameEngine';
import { Vector2D } from '../types';

interface GameCanvasProps {
  level: number;
  onWin: () => void;
  onLoss: () => void;
  engineRef: React.MutableRefObject<GameEngine | null>;
  isDev?: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ level, engineRef, isDev }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<Vector2D | null>(null);
  const currentDragRef = useRef<Vector2D | null>(null);
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const starsRef = useRef<{ x: number; y: number }[]>([]);
  const trailRef = useRef<{ x: number; y: number; wave: boolean }[]>([]);

  useEffect(() => {
    const stars = [];
    const rng = (seed: number) => {
      const s = seed * 12345.678;
      return (Math.sin(s) * 10000) % 1;
    };
    for (let i = 0; i < 75; i++) {
      stars.push({
        x: Math.abs(rng(i)) * PHYSICS_WIDTH,
        y: Math.abs(rng(i + 0.5)) * PHYSICS_HEIGHT,
      });
    }
    starsRef.current = stars;
    trailRef.current = [];
  }, [level]);

  const getCanvasCoordsFromClient = useCallback((clientX: number, clientY: number): Vector2D => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const x = (clientX - rect.left) * (PHYSICS_WIDTH / rect.width);
    const y = (clientY - rect.top) * (PHYSICS_HEIGHT / rect.height);
    return { x, y };
  }, []);

  const getLaunchVelocity = (dStart: Vector2D, cDrag: Vector2D): Vector2D => {
    // Clamp max pull so trajectory stays controllable
    const rawDx = (dStart.x - cDrag.x) * 0.045;
    const rawDy = (dStart.y - cDrag.y) * 0.045;
    const speed = Math.hypot(rawDx, rawDy);
    const maxLaunchSpeed = 24;
    if (speed > maxLaunchSpeed) {
      return {
        x: (rawDx / speed) * maxLaunchSpeed,
        y: (rawDy / speed) * maxLaunchSpeed,
      };
    }
    return { x: rawDx, y: rawDy };
  };

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, engine: GameEngine, time: number) => {
      ctx.save();

      // Screen Shake proportional to heat/collision
      if (engine.collided) {
        const shakeAmt = 5 + engine.gameState.heat / 20;
        ctx.translate((Math.random() - 0.5) * shakeAmt, (Math.random() - 0.5) * shakeAmt);
      }

      ctx.clearRect(0, 0, PHYSICS_WIDTH, PHYSICS_HEIGHT);
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, PHYSICS_WIDTH, PHYSICS_HEIGHT);

      // Reset trail when probe resets to preview
      if (!engine.probe.launched && trailRef.current.length > 0) {
        trailRef.current = [];
      }

      // Draw Parallax Stars
      const probe = engine.probe;
      const scrollX = (probe.pos.x - PHYSICS_WIDTH / 2) * 0.05;
      const scrollY = (probe.pos.y - PHYSICS_HEIGHT / 2) * 0.05;

      const stars = starsRef.current;
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const parallaxX = (star.x - scrollX) % PHYSICS_WIDTH;
        const parallaxY = (star.y - scrollY) % PHYSICS_HEIGHT;

        const x = parallaxX < 0 ? parallaxX + PHYSICS_WIDTH : parallaxX;
        const y = parallaxY < 0 ? parallaxY + PHYSICS_HEIGHT : parallaxY;

        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 240, 255, 0.18)';
        ctx.fillRect(x, y, 1.5, 1.5);

        if (i % 5 === 0) {
          const p2X = (star.x - scrollX * 2.5) % PHYSICS_WIDTH;
          const p2Y = (star.y - scrollY * 2.5) % PHYSICS_HEIGHT;
          const x2 = p2X < 0 ? p2X + PHYSICS_WIDTH : p2X;
          const y2 = p2Y < 0 ? p2Y + PHYSICS_HEIGHT : p2Y;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.fillRect(x2, y2, 2.2, 2.2);
        }
      }

      // Draw Objects
      const objects = engine.levelData.objects;
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];

        if (obj.type === 'Nebula') {
          const nTime = time / 2000;
          const pulse = Math.sin(nTime * 2) * 0.04 + 0.14;
          const nColor = obj.color || '#ff5500';

          const gradient = ctx.createRadialGradient(obj.pos.x, obj.pos.y, 0, obj.pos.x, obj.pos.y, obj.radius);
          gradient.addColorStop(0, `${nColor}${Math.floor((pulse + 0.18) * 255).toString(16).padStart(2, '0')}`);
          gradient.addColorStop(0.6, `${nColor}${Math.floor(pulse * 0.5 * 255).toString(16).padStart(2, '0')}`);
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(obj.pos.x, obj.pos.y, obj.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = 'rgba(255, 180, 90, 0.35)';
          for (let k = 0; k < 12; k++) {
            const angle = (nTime * 0.35 + k * (Math.PI / 6)) % (Math.PI * 2);
            const r = obj.radius * 0.68 * (1 + 0.18 * Math.sin(nTime + k));
            ctx.beginPath();
            ctx.arc(obj.pos.x + Math.cos(angle) * r, obj.pos.y + Math.sin(angle) * r, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (obj.type === 'ColdSink') {
          const cTime = time / 1400;
          const sinkGrad = ctx.createRadialGradient(obj.pos.x, obj.pos.y, 5, obj.pos.x, obj.pos.y, obj.radius);
          sinkGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
          sinkGrad.addColorStop(0.65, 'rgba(0, 240, 255, 0.08)');
          sinkGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = sinkGrad;
          ctx.beginPath();
          ctx.arc(obj.pos.x, obj.pos.y, obj.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.save();
          ctx.translate(obj.pos.x, obj.pos.y);
          ctx.rotate(-cTime * 0.6);
          ctx.strokeStyle = 'rgba(125, 211, 252, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 8]);
          ctx.beginPath();
          ctx.arc(0, 0, obj.radius * 0.72, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
          ctx.setLineDash([]);
        } else if (obj.type === 'QuantumField') {
          const qTime = time / 500;
          ctx.save();
          ctx.translate(obj.pos.x, obj.pos.y);
          ctx.rotate(qTime);

          ctx.strokeStyle = '#00F0FF';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 10]);
          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const angle = (j / 6) * Math.PI * 2;
            const r = obj.radius * (0.85 + Math.sin(qTime * 3 + j) * 0.08);
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = 'rgba(0, 240, 200, 0.07)';
          ctx.fill();
          ctx.restore();
          ctx.setLineDash([]);
        } else if (obj.type === 'Planet') {
          const planetColor = obj.color || '#1a1a1a';
          const glowColor = obj.color ? `${obj.color}55` : 'rgba(255, 255, 255, 0.05)';

          // Gravitational Lensing halo
          ctx.save();
          ctx.beginPath();
          const lensRadius = obj.radius * 1.8;
          const lensGrad = ctx.createRadialGradient(obj.pos.x, obj.pos.y, obj.radius, obj.pos.x, obj.pos.y, lensRadius);
          lensGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
          lensGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
          lensGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = lensGrad;
          ctx.arc(obj.pos.x, obj.pos.y, lensRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.shadowBlur = 35;
          ctx.shadowColor = glowColor;
          const gradient = ctx.createRadialGradient(
            obj.pos.x - obj.radius * 0.3,
            obj.pos.y - obj.radius * 0.3,
            0,
            obj.pos.x,
            obj.pos.y,
            obj.radius
          );
          gradient.addColorStop(0, planetColor);
          gradient.addColorStop(0.8, '#050508');
          gradient.addColorStop(1, '#000');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(obj.pos.x, obj.pos.y, obj.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        } else if (obj.type === 'Asteroid') {
          ctx.save();
          ctx.translate(obj.pos.x, obj.pos.y);
          ctx.rotate((obj.angle || 0) + time / 6000);
          const verts = obj.vertices || [1, 0.85, 1.05, 0.9, 1.1, 0.8, 1.0, 0.92];
          ctx.beginPath();
          for (let v = 0; v < verts.length; v++) {
            const a = (v / verts.length) * Math.PI * 2;
            const r = obj.radius * verts[v];
            const vx = Math.cos(a) * r;
            const vy = Math.sin(a) * r;
            if (v === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.fillStyle = engine.probe.isWaveState ? 'rgba(60, 60, 75, 0.35)' : '#27272a';
          ctx.strokeStyle = engine.probe.isWaveState ? 'rgba(255, 0, 255, 0.35)' : 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if (obj.type === 'Stardust' && !obj.collected) {
          ctx.fillStyle = '#FFD700';
          const pulse = 1 + Math.sin(time / 200 + obj.pos.x) * 0.35;
          ctx.beginPath();
          ctx.arc(obj.pos.x, obj.pos.y, obj.radius * pulse, 0, Math.PI * 2);
          ctx.fill();
        } else if (obj.type === 'Portal') {
          const portalTime = time / 1000;
          ctx.save();
          ctx.translate(obj.pos.x, obj.pos.y);
          ctx.rotate(portalTime * -1.5);

          for (let j = 0; j < 5; j++) {
            ctx.rotate((Math.PI * 2) / 5);
            const gradient = ctx.createLinearGradient(0, 0, obj.radius, 0);
            gradient.addColorStop(0, 'rgba(168, 85, 247, 0.9)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, obj.radius * (1 - j * 0.15), 0, Math.PI);
            ctx.stroke();
          }
          ctx.restore();
        } else if (obj.type === 'DataFragment' && !obj.collected) {
          ctx.save();
          ctx.translate(obj.pos.x, obj.pos.y);
          ctx.rotate(time / 400);

          ctx.fillStyle = '#00F0FF';
          ctx.shadowBlur = 15;
          ctx.shadowColor = '#00F0FF';

          ctx.beginPath();
          ctx.moveTo(0, -obj.radius);
          ctx.lineTo(obj.radius, 0);
          ctx.lineTo(0, obj.radius);
          ctx.lineTo(-obj.radius, 0);
          ctx.closePath();
          ctx.fill();

          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fff';
          ctx.fillRect(-obj.radius / 3, -obj.radius / 3, obj.radius / 1.5, obj.radius / 1.5);
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }

      // Draw Goal (The Eye of the Singularity)
      const goal = engine.levelData.goalPos;
      const goalCollected = engine.gameState.goalCollected;
      const quotaMet = engine.gameState.stardust >= engine.gameState.requiredStardust;
      const lockedFlash = Boolean(engine.gameState.goalLockedFlashUntil && Date.now() < engine.gameState.goalLockedFlashUntil);

      ctx.save();
      ctx.translate(goal.x, goal.y);
      const rotation = time / 600;

      const eyeRadius = 60;
      const scleraGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, eyeRadius * 1.5);
      scleraGrad.addColorStop(
        0,
        lockedFlash
          ? 'rgba(239, 68, 68, 0.28)'
          : goalCollected
          ? 'rgba(255,255,255,0.2)'
          : quotaMet
          ? 'rgba(0, 240, 255, 0.22)'
          : 'rgba(255, 200, 0, 0.15)'
      );
      scleraGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = scleraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, eyeRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Eyelids
      ctx.strokeStyle = lockedFlash ? '#ef4444' : quotaMet ? '#00f0ff' : '#FFD700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-eyeRadius, 0);
      ctx.quadraticCurveTo(0, -eyeRadius * 0.8, eyeRadius, 0);
      ctx.quadraticCurveTo(0, eyeRadius * 0.8, -eyeRadius, 0);
      ctx.stroke();

      // Iris
      const irisRadius = 25 + Math.sin(time / 300) * 3;
      const irisGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, irisRadius);
      if (quotaMet) {
        irisGrad.addColorStop(0, '#fff');
        irisGrad.addColorStop(0.3, '#00f0ff');
        irisGrad.addColorStop(1, '#0055ff');
      } else {
        irisGrad.addColorStop(0, '#fff');
        irisGrad.addColorStop(0.3, '#FFD700');
        irisGrad.addColorStop(1, '#ff4400');
      }
      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.arc(0, 0, irisRadius, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#000';
      ctx.shadowBlur = quotaMet ? 15 : 5;
      ctx.shadowColor = quotaMet ? '#00f0ff' : '#FFD700';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, irisRadius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Neural radial lines
      ctx.strokeStyle = quotaMet ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 215, 0, 0.22)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 4 + rotation * 0.2);
        ctx.beginPath();
        ctx.moveTo(irisRadius, 0);
        ctx.lineTo(eyeRadius - 10, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Status caption below Eye
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      if (lockedFlash) {
        const missing = Math.ceil(engine.gameState.requiredStardust - engine.gameState.stardust);
        ctx.fillStyle = '#f87171';
        ctx.fillText(`LOCKED · NEED ${missing} MORE STARDUST`, 0, eyeRadius + 24);
      } else if (quotaMet) {
        ctx.fillStyle = '#00f0ff';
        ctx.fillText('SINGULARITY OPEN', 0, eyeRadius + 24);
      } else {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.65)';
        ctx.fillText(
          `${Math.floor(engine.gameState.stardust)}/${engine.gameState.requiredStardust} DUST`,
          0,
          eyeRadius + 24
        );
      }

      ctx.restore();

      // Trajectory Aiming Visualization (Pre-launch OR Mid-flight course correction)
      const dStart = dragStartRef.current;
      const cDrag = currentDragRef.current;

      if (dStart && cDrag && (engine.gameState.status === 'preview' || engine.gameState.status === 'playing')) {
        const launchVelocity = getLaunchVelocity(dStart, cDrag);
        const pullX = cDrag.x - dStart.x;
        const pullY = cDrag.y - dStart.y;

        // Draw Slingshot Vector anchored to probe
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 1.5;
        ctx.moveTo(engine.probe.pos.x, engine.probe.pos.y);
        ctx.lineTo(engine.probe.pos.x + pullX, engine.probe.pos.y + pullY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 240, 255, 0.14)';
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.arc(engine.probe.pos.x + pullX, engine.probe.pos.y + pullY, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Exact unified trajectory preview
        const trajectory = engine.getTrajectory(launchVelocity);
        const dashOffset = (-time / 12) % 24;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = engine.probe.isWaveState ? 'rgba(255, 0, 255, 0.85)' : 'rgba(0, 240, 255, 0.85)';
        ctx.setLineDash([4, 10]);
        ctx.lineDashOffset = dashOffset;
        ctx.lineWidth = 2.5;
        for (let pIdx = 0; pIdx < trajectory.length; pIdx++) {
          const pt = trajectory[pIdx];
          if (pIdx === 0) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            const prevPt = trajectory[pIdx - 1];
            if (Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y) > 120) {
              ctx.moveTo(pt.x, pt.y);
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
        }
        ctx.stroke();
        ctx.restore();

        if (trajectory.length > 0) {
          const last = trajectory[trajectory.length - 1];
          ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.beginPath();
          ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (!engine.probe.launched && engine.gameState.status === 'preview') {
        // Subtle onboarding prompt near start probe
        ctx.save();
        ctx.font = '700 13px "JetBrains Mono", monospace';
        ctx.fillStyle = `rgba(0, 240, 255, ${0.45 + Math.sin(time / 400) * 0.25})`;
        ctx.textAlign = 'left';
        ctx.fillText('DRAG ANYWHERE TO AIM & LAUNCH', engine.probe.pos.x + 28, engine.probe.pos.y + 5);
        ctx.restore();
      }

      // Developer Solved Path (subtle reference if enabled)
      if (isDev && engine.levelData.solvedTrajectory) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.setLineDash([5, 8]);
        ctx.lineWidth = 1;
        const solved = engine.levelData.solvedTrajectory;
        for (let sIdx = 0; sIdx < solved.length; sIdx++) {
          const pt = solved[sIdx];
          if (sIdx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Record & Render Probe Ribbon Trail
      if (engine.probe.launched && engine.gameState.status === 'playing') {
        const lastTrail = trailRef.current[trailRef.current.length - 1];
        if (!lastTrail || Math.hypot(probe.pos.x - lastTrail.x, probe.pos.y - lastTrail.y) > 2.5) {
          trailRef.current.push({ x: probe.pos.x, y: probe.pos.y, wave: probe.isWaveState });
          if (trailRef.current.length > 28) trailRef.current.shift();
        }
      }

      const trail = trailRef.current;
      if (trail.length > 1) {
        ctx.save();
        ctx.lineCap = 'round';
        for (let t = 1; t < trail.length; t++) {
          const p0 = trail[t - 1];
          const p1 = trail[t];
          // Avoid drawing a giant line across the screen on Portal warp
          if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 120) continue;
          const alpha = (t / trail.length) * (p1.wave ? 0.65 : 0.45);
          ctx.strokeStyle = p1.wave ? `rgba(255, 0, 255, ${alpha})` : `rgba(0, 240, 255, ${alpha})`;
          ctx.lineWidth = (t / trail.length) * (p1.wave ? 5 : 3.5);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw Probe Vessel
      const { pos, prevPos, isWaveState } = probe;
      const velocity = { x: pos.x - prevPos.x, y: pos.y - prevPos.y };
      const probeAngle = Math.hypot(velocity.x, velocity.y) > 0.01 ? Math.atan2(velocity.y, velocity.x) : 0;
      const heatFactor = engine.gameState.heat / 100;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(probeAngle);

      if (!isWaveState) {
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15 + heatFactor * 20;
        ctx.shadowColor = heatFactor > 0.5 ? '#ff4400' : '#00f0ff';

        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = heatFactor > 0.5 ? '#ff4400' : '#00f0ff';
        ctx.beginPath();
        ctx.arc(3, 0, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ff00ff';
        ctx.shadowBlur = 25 + heatFactor * 20;
        ctx.shadowColor = heatFactor > 0.7 ? '#ffffff' : '#ff00ff';

        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-8, -3.5);
        ctx.lineTo(-8, 3.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.restore();
    },
    [isDev]
  );

  const animate = useCallback(
    (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const rawDt = (time - lastTimeRef.current) / 16.67;
      const dt = Math.min(Math.max(rawDt, 0.05), 2.5);
      lastTimeRef.current = time;

      if (engineRef.current) {
        engineRef.current.update(dt);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) draw(ctx, engineRef.current, time);
      }

      requestRef.current = requestAnimationFrame(animate);
    },
    [engineRef, draw]
  );

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  // Global mouse/touch move & release handlers so dragging past canvas edge never gets stuck
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      currentDragRef.current = getCanvasCoordsFromClient(e.clientX, e.clientY);
    };

    const handleWindowTouchMove = (e: TouchEvent) => {
      if (!dragStartRef.current || e.touches.length === 0) return;
      currentDragRef.current = getCanvasCoordsFromClient(e.touches[0].clientX, e.touches[0].clientY);
    };

    const finishDrag = () => {
      if (!dragStartRef.current || !currentDragRef.current) return;
      const dStart = dragStartRef.current;
      const cDrag = currentDragRef.current;
      const pullDist = Math.hypot(dStart.x - cDrag.x, dStart.y - cDrag.y);

      if (pullDist > 8) {
        const launchVelocity = getLaunchVelocity(dStart, cDrag);
        engineRef.current?.launch(launchVelocity);
      }
      dragStartRef.current = null;
      currentDragRef.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', finishDrag);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: true });
    window.addEventListener('touchend', finishDrag);
    window.addEventListener('touchcancel', finishDrag);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', finishDrag);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', finishDrag);
      window.removeEventListener('touchcancel', finishDrag);
    };
  }, [engineRef, getCanvasCoordsFromClient]);

  const handlePointerStart = (clientX: number, clientY: number) => {
    const status = engineRef.current?.gameState.status;
    if (status === 'won' || status === 'lost') return;
    const pos = getCanvasCoordsFromClient(clientX, clientY);
    dragStartRef.current = pos;
    currentDragRef.current = pos;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-black overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      <canvas
        id="game-canvas"
        ref={canvasRef}
        width={PHYSICS_WIDTH}
        height={PHYSICS_HEIGHT}
        className="w-full h-full object-contain cursor-crosshair"
        onMouseDown={(e) => handlePointerStart(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          if (e.touches.length > 0) {
            handlePointerStart(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
      />
    </div>
  );
};
