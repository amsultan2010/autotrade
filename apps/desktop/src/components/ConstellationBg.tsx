import { useEffect, useRef } from 'react';

interface Particle { x: number; y: number; vx: number; vy: number; radius: number; opacity: number; }
interface RainCol  { x: number; y: number; speed: number; trail: string[]; len: number; }

const PARTICLE_COUNT = 90;
const CONNECTION_DIST = 155;
const BASE_SPEED = 0.28;
const RAIN_COUNT = 22;
const HEX = '0123456789ABCDEF';
const FONT_H = 13;

function rHex(): string { return HEX[Math.floor(Math.random() * 16)] ?? '0'; }

function makeParticle(w: number, h: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const spd = BASE_SPEED * (0.4 + Math.random() * 0.6);
  return { x: Math.random() * w, y: Math.random() * h, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, radius: 1.2 + Math.random() * 1.5, opacity: 0.3 + Math.random() * 0.5 };
}

function makeRainCol(w: number, h: number): RainCol {
  const len = 8 + Math.floor(Math.random() * 12);
  return { x: Math.floor(Math.random() * (w / 14)) * 14, y: -Math.random() * h, speed: 0.5 + Math.random() * 0.9, trail: Array.from({ length: len + 2 }, rHex), len };
}

export function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Non-null alias — ctx is confirmed non-null after the guard above
    const c = ctx;

    let w = window.innerWidth, h = window.innerHeight;
    canvas.width = w; canvas.height = h;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => makeParticle(w, h));
    const rain = Array.from({ length: RAIN_COUNT }, () => makeRainCol(w, h));
    let rafId: number;

    function draw() {
      c.clearRect(0, 0, w, h);

      // ── Data rain (drawn first, behind everything) ──
      c.font = `${FONT_H}px "IBM Plex Mono", monospace`;
      for (const col of rain) {
        col.y += col.speed;
        if (Math.random() < 0.12) col.trail[Math.floor(Math.random() * col.trail.length)] = rHex();
        if (col.y > h + col.len * FONT_H) {
          col.y = -col.len * FONT_H - 20;
          col.x = Math.floor(Math.random() * (w / 14)) * 14;
        }
        for (let i = 0; i < col.len; i++) {
          const cy = col.y - i * FONT_H;
          if (cy < -FONT_H || cy > h + FONT_H) continue;
          const alpha = i === 0 ? 0.85 : (1 - i / col.len) * 0.14;
          c.fillStyle = i === 0 ? `rgba(190,255,230,${alpha})` : `rgba(0,200,150,${alpha})`;
          c.fillText(col.trail[i % col.trail.length] ?? '0', col.x, cy);
        }
      }

      // ── Mouse glow ──
      const mx = mouse.current.x, my = mouse.current.y;
      if (mx > -100) {
        const g = c.createRadialGradient(mx, my, 0, mx, my, 120);
        g.addColorStop(0, 'rgba(0,200,150,0.09)');
        g.addColorStop(1, 'rgba(0,200,150,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(mx, my, 120, 0, Math.PI * 2); c.fill();
      }

      // ── Move & repel particles ──
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        const dx = p.x - mx, dy = p.y - my;
        const d2 = dx * dx + dy * dy;
        if (d2 < 140 * 140 && d2 > 0) {
          const d = Math.sqrt(d2);
          const force = ((140 - d) / 140) * 0.45;
          p.vx += (dx / d) * force; p.vy += (dy / d) * force;
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (spd > 2.5) { p.vx = (p.vx / spd) * 2.5; p.vy = (p.vy / spd) * 2.5; }
        } else {
          const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          if (spd > BASE_SPEED * 1.3) { p.vx *= 0.99; p.vy *= 0.99; }
        }
      }

      // ── Connections ──
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]!;
          const b = particles[j]!;
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > CONNECTION_DIST) continue;
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
          c.strokeStyle = `rgba(0,200,150,${(1 - dist / CONNECTION_DIST) * 0.22})`;
          c.lineWidth = 0.8; c.stroke();
        }
      }

      // ── Particles ──
      for (const p of particles) {
        c.beginPath(); c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        c.fillStyle = `rgba(0,200,150,${p.opacity})`; c.fill();
      }

      rafId = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w; canvas.height = h; };
    const onMouse = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };

    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.72 }} />;
}
