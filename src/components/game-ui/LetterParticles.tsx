// LetterParticles — slow, ambient floating letters with a realistic aurora
// backdrop using ribbon polygons, vertical striations, and bloom.
// Purely decorative: no interaction, no physics — just drift & glow.

import { useEffect, useRef } from 'react';

const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789;:\'",.<>/?[]{}|\\!@#$%^&*()'.split('');
// Tuned for lower GPU/CPU load while keeping the same visual style.
const PARTICLE_COUNT = 36;

// ---------------------------------------------------------------------------
// Letter particles
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  char: string;
  size: number;
  opacity: number;
  speed: number;
  drift: number;
  phase: number;
}

function createParticle(
  w: number,
  h: number,
  rand: () => number,
  scattered = false,
): Particle {
  return {
    x: rand() * w,
    y: scattered ? rand() * h : h + 20,
    char: CHARS[Math.floor(rand() * CHARS.length)],
    size: 16 + rand() * 20,
    opacity: 0.06 + rand() * 0.10,
    speed: 0.15 + rand() * 0.35,
    drift: (rand() - 0.5) * 0.3,
    phase: rand() * Math.PI * 2,
  };
}

// ---------------------------------------------------------------------------
// 2D value noise (fast, good enough for aurora turbulence)
// ---------------------------------------------------------------------------

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerpN(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function noise2(x: number, y: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);
  return lerpN(
    lerpN(hash2(x0, y0), hash2(x0 + 1, y0), sx),
    lerpN(hash2(x0, y0 + 1), hash2(x0 + 1, y0 + 1), sx),
    sy,
  );
}

function fbm2(x: number, y: number, octaves = 4): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Aurora curtain data
// ---------------------------------------------------------------------------

interface AuroraCurtain {
  baseY: number;
  hue: number;
  speed: number;
  phase: number;
  opacity: number;
  thickness: number;
  drift: number;
  waveAmp: number;
  waveFreq: number;
  detail: number;
}

const AURORA_COUNT = 2;
const AURORA_HUES = [185, 220, 275]; // turquoise / blue / purple

function createAuroraCurtain(i: number, rand: () => number): AuroraCurtain {
  return {
    baseY: 0.18 + i * 0.18 + rand() * 0.05,
    hue: AURORA_HUES[i % AURORA_HUES.length] + (rand() * 16 - 8),
    speed: 0.18 + rand() * 0.25,
    phase: rand() * Math.PI * 2,
    opacity: 0.05 + rand() * 0.04,   // much lower — ribbons are subtle structure
    thickness: 0.22 + rand() * 0.18,
    drift: 0.10 + rand() * 0.18,
    waveAmp: 0.06 + rand() * 0.06,
    waveFreq: 0.8 + rand() * 1.2,
    detail: 1.6 + rand() * 1.6,
  };
}

// ---------------------------------------------------------------------------
// Soft glow blobs — wide ellipses for the dreamy, blurry aurora base
// ---------------------------------------------------------------------------

interface AuroraGlow {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  hue: number;
  speed: number;
  phase: number;
  opacity: number;
  wanderX: number;
  wanderY: number;
}

const GLOW_COUNT = 4;
const GLOW_HUES = [185, 205, 235, 260, 285];

const GLOBAL_ANIMATION_START =
  typeof performance !== 'undefined' ? performance.now() : Date.now();

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function createAuroraGlow(i: number, rand: () => number): AuroraGlow {
  return {
    x: 0.1 + rand() * 0.8,
    y: 0.15 + i * 0.14 + rand() * 0.08,
    radiusX: 0.30 + rand() * 0.25,
    radiusY: 0.10 + rand() * 0.10,
    hue: GLOW_HUES[i % GLOW_HUES.length] + rand() * 12 - 6,
    speed: 0.5 + rand() * 0.6,
    phase: rand() * Math.PI * 2,
    opacity: 0.18 + rand() * 0.14,
    wanderX: 0.06 + rand() * 0.10,
    wanderY: 0.06 + rand() * 0.12,
  };
}

// ---------------------------------------------------------------------------
// Draw a single aurora curtain as a ribbon with striations
// ---------------------------------------------------------------------------

function drawCurtain(
  ctx: CanvasRenderingContext2D,
  c: AuroraCurtain,
  t: number,
  w: number,
  h: number,
) {
  const baseYpx = c.baseY * h;
  const thicknessPx = c.thickness * h;
  const steps = 90;

  // Build ribbon polygon: top edge + bottom edge
  const topEdge: { x: number; y: number }[] = [];
  const botEdge: { x: number; y: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const x = u * w;

    const driftX = t * c.speed * 40;
    const n = fbm2(u * c.detail + driftX * 0.002, t * c.speed * 0.12 + c.phase, 4);
    const wave = Math.sin(u * Math.PI * 2 * c.waveFreq + t * c.speed + c.phase);

    const yTop = baseYpx + wave * (c.waveAmp * h) + (n - 0.5) * (0.18 * h);

    // Varying thickness via noise
    const n2 = fbm2(u * (c.detail * 1.8) + 12.3, t * c.speed * 0.18 + c.phase + 9.1, 3);
    const thick = thicknessPx * (0.65 + n2 * 0.75);

    topEdge.push({ x, y: yTop });
    botEdge.push({ x, y: yTop + thick });
  }

  // Draw ribbon path
  ctx.beginPath();
  ctx.moveTo(topEdge[0].x, topEdge[0].y);
  for (let i = 1; i < topEdge.length; i++) ctx.lineTo(topEdge[i].x, topEdge[i].y);
  for (let i = botEdge.length - 1; i >= 0; i--) ctx.lineTo(botEdge[i].x, botEdge[i].y);
  ctx.closePath();

  // Soft vertical gradient fill
  const grad = ctx.createLinearGradient(0, baseYpx, 0, baseYpx + thicknessPx * 1.4);
  grad.addColorStop(0, `hsla(${c.hue}, 90%, 70%, ${c.opacity})`);
  grad.addColorStop(0.45, `hsla(${c.hue + 10}, 95%, 60%, ${c.opacity * 0.85})`);
  grad.addColorStop(1, `hsla(${c.hue + 25}, 95%, 45%, 0)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Striations: thin vertical streaks inside the ribbon (clipped)
  ctx.save();
  ctx.clip();
  ctx.globalCompositeOperation = 'lighter';

  const stripes = 120;
  for (let s = 0; s < stripes; s++) {
    const u = s / (stripes - 1);
    const x = u * w;

    const flicker = fbm2(u * 9.0 + 1.7, t * c.speed * 0.9 + c.phase, 4);
    const band = Math.pow(flicker, 2.2);
    const alpha = (0.03 + band * 0.12) * c.opacity * 3.2;

    const reach = 0.55 + fbm2(u * 2.0 + 44.0, t * c.speed * 0.3 + 10.0, 3) * 0.7;
    const y1 = baseYpx - 40;
    const y2 = baseYpx + thicknessPx * reach;

    ctx.strokeStyle = `hsla(${c.hue + band * 20}, 100%, ${55 + band * 25}%, ${alpha})`;
    ctx.lineWidth = 1.2 + band * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LetterParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const curtains = useRef<AuroraCurtain[]>([]);
  const glowBlobs = useRef<AuroraGlow[]>([]);
  const glowCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create offscreen glow canvas for bloom
    const glowCanvas = document.createElement('canvas');
    const gctx = glowCanvas.getContext('2d');
    if (!gctx) return;
    glowCanvasRef.current = glowCanvas;

    function resize() {
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      canvas!.width = w;
      canvas!.height = h;
      canvas!.style.width = `${window.innerWidth}px`;
      canvas!.style.height = `${window.innerHeight}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      glowCanvas.width = w;
      glowCanvas.height = h;
      gctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener('resize', resize);

    // Seed
    const rand = mulberry32(hashSeed('veloxtype-lobby-background'));
    particles.current = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(window.innerWidth, window.innerHeight, rand, true),
    );
    curtains.current = Array.from({ length: AURORA_COUNT }, (_, i) => createAuroraCurtain(i, rand));
    glowBlobs.current = Array.from({ length: GLOW_COUNT }, (_, i) => createAuroraGlow(i, rand));

    let frame = 0;
    let lastFrameTime = 0;
    const frameIntervalMs = 1000 / 30;

    function draw(now: number) {
      if (document.hidden) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      if (now - lastFrameTime < frameIntervalMs) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = now;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const t = (performance.now() - GLOBAL_ANIMATION_START) / 1000;

      // Clear main canvas
      ctx!.clearRect(0, 0, w, h);

      // ── 1. Soft glow blobs (dreamy base layer, drawn directly to main) ──
      for (const g of glowBlobs.current) {
        const gt = frame * 0.001 * g.speed;

        const bx = (g.x + Math.sin(gt + g.phase) * g.wanderX
                        + Math.sin(gt * 0.6 + g.phase * 2.3) * g.wanderX * 0.35) * w;
        const by = (g.y + Math.sin(gt * 0.25 + g.phase) * g.wanderY
                        + Math.sin(gt * 0.15 + g.phase * 2.5) * g.wanderY * 0.4) * h;

        const rxScale = 1 + Math.sin(gt * 1.2 + g.phase) * 0.12;
        const ryScale = 1 + Math.cos(gt * 0.9 + g.phase) * 0.10;
        const rx = g.radiusX * w * rxScale;
        const ry = g.radiusY * h * ryScale;

        const currentHue = 170 + ((g.hue + frame * 0.02) % 130);
        const pulse = g.opacity + Math.sin(gt * 1.5 + g.phase) * 0.03;

        const gradient = ctx!.createRadialGradient(bx, by, 0, bx, by, Math.max(rx, ry));
        gradient.addColorStop(0, `hsla(${currentHue}, 95%, 65%, ${pulse})`);
        gradient.addColorStop(0.3, `hsla(${currentHue}, 85%, 55%, ${pulse * 0.55})`);
        gradient.addColorStop(0.65, `hsla(${currentHue}, 75%, 45%, ${pulse * 0.2})`);
        gradient.addColorStop(1, `hsla(${currentHue}, 60%, 35%, 0)`);

        ctx!.save();
        ctx!.translate(bx, by);
        ctx!.scale(1, ry / rx);
        ctx!.translate(-bx, -by);
        ctx!.fillStyle = gradient;
        ctx!.beginPath();
        ctx!.arc(bx, by, rx, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      // ── 2. Ribbon curtains with striations (faint structure on top) ──
      gctx!.clearRect(0, 0, w, h);
      gctx!.globalCompositeOperation = 'source-over';

      for (const c of curtains.current) {
        const hue = c.hue + Math.sin(t * 0.04 + c.phase) * 6;
        drawCurtain(gctx!, { ...c, hue }, t, w, h);
      }

      // Bloom pass: blurred ribbon layer adds soft glow on top of blobs
      ctx!.save();
      ctx!.globalCompositeOperation = 'lighter';

      ctx!.globalAlpha = 0.5;
      ctx!.filter = 'blur(50px)';
      ctx!.drawImage(glowCanvas, 0, 0, w, h);

      ctx!.globalAlpha = 0.25;
      ctx!.filter = 'blur(22px)';
      ctx!.drawImage(glowCanvas, 0, 0, w, h);

      ctx!.restore();

      // Very subtle sharp ribbon detail on top
      ctx!.save();
      ctx!.globalCompositeOperation = 'lighter';
      ctx!.globalAlpha = 0.08;
      ctx!.drawImage(glowCanvas, 0, 0, w, h);
      ctx!.restore();

      // ── Letter particles (drawn on top of everything) ──
      ctx!.globalCompositeOperation = 'source-over';
      for (const p of particles.current) {
        p.y -= p.speed;
        p.x += p.drift + Math.sin(frame * 0.005 + p.phase) * 0.15;

        if (p.y < -30 || p.x < -30 || p.x > w + 30) {
          Object.assign(p, createParticle(w, h, rand, false));
        }

        ctx!.globalAlpha = p.opacity;
        ctx!.font = `${p.size}px "JetBrains Mono", monospace`;
        ctx!.fillStyle = '#ffffff';
        ctx!.fillText(p.char, p.x, p.y);
      }

      ctx!.globalAlpha = 1;
      frame++;
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-0 pointer-events-none"
      aria-hidden
    />
  );
}
