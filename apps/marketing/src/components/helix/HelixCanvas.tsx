'use client';

import { useEffect, useRef } from 'react';

/**
 * HelixCanvas
 * -----------------------------------------------------------------
 * A continuously-rotating double-helix rendered to <canvas> for
 * GPU-friendly animation (no per-frame React reconciliation).
 *
 * Two strands wrap around a central axis — labelled "Admin" and
 * "CRM" in the calling component — visualising the product duo.
 *
 * Honors `prefers-reduced-motion`: in that case the helix is
 * rendered statically with no animation loop running.
 *
 * Props:
 *  - height       svg viewport height in px (default 560)
 *  - speed        radians-per-frame (default 0.012)
 *  - color1       primary strand stroke + node color
 *  - color2       secondary strand stroke + node color
 *  - rungColor    color of the connecting "base pairs"
 */
type HelixCanvasProps = {
  height?: number;
  speed?: number;
  color1?: string;
  color2?: string;
  rungColor?: string;
  className?: string;
};

export function HelixCanvas({
  height = 560,
  speed = 0.012,
  color1 = '#3DD6FF',
  color2 = '#937DFF',
  rungColor = 'rgba(255,255,255,0.10)',
  className,
}: HelixCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /** Resize the canvas backing store to match its CSS box. */
    const resize = () => {
      const { clientWidth, clientHeight } = canvas;
      canvas.width = Math.floor(clientWidth * dpr);
      canvas.height = Math.floor(clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let phase = 0;
    const NODES = 26;       // beads per strand
    const RUNGS_EVERY = 2;  // draw a rung every N nodes
    const AMPLITUDE = 110;  // horizontal sweep
    const TWIST = Math.PI * 2.4; // total twist top-to-bottom

    const render = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;

      ctx.clearRect(0, 0, w, h);

      // Soft glow background behind helix
      const grad = ctx.createRadialGradient(cx, h * 0.45, 20, cx, h * 0.45, Math.max(w, h) * 0.6);
      grad.addColorStop(0, 'rgba(13,190,235,0.06)');
      grad.addColorStop(0.55, 'rgba(111,91,255,0.04)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Compute strand points
      const stepY = h / (NODES - 1);
      const strandA: { x: number; y: number; depth: number }[] = [];
      const strandB: { x: number; y: number; depth: number }[] = [];

      for (let i = 0; i < NODES; i++) {
        const t = i / (NODES - 1);
        const angle = phase + t * TWIST;
        const xA = Math.sin(angle) * AMPLITUDE;
        const xB = Math.sin(angle + Math.PI) * AMPLITUDE;
        const y = i * stepY;
        // Depth ranges 0..1 (1 = front); used for size + alpha cues
        const depthA = (Math.cos(angle) + 1) / 2;
        const depthB = (Math.cos(angle + Math.PI) + 1) / 2;
        strandA.push({ x: cx + xA, y, depth: depthA });
        strandB.push({ x: cx + xB, y, depth: depthB });
      }

      // Draw rungs (base pairs) first so strand nodes sit on top
      ctx.lineWidth = 1;
      for (let i = 0; i < NODES; i += RUNGS_EVERY) {
        const a = strandA[i];
        const b = strandB[i];
        const frontness = Math.max(a.depth, b.depth);
        ctx.strokeStyle = `rgba(255,255,255,${0.06 + frontness * 0.10})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Draw strands as smooth curves
      const drawStrand = (
        strand: { x: number; y: number; depth: number }[],
        color: string,
      ) => {
        ctx.beginPath();
        ctx.moveTo(strand[0].x, strand[0].y);
        for (let i = 1; i < strand.length - 1; i++) {
          const p = strand[i];
          const next = strand[i + 1];
          const xc = (p.x + next.x) / 2;
          const yc = (p.y + next.y) / 2;
          ctx.quadraticCurveTo(p.x, p.y, xc, yc);
        }
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = color;
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
      };

      drawStrand(strandA, color1);
      drawStrand(strandB, color2);

      // Draw nodes (beads) on each strand, sized by depth
      const drawNodes = (
        strand: { x: number; y: number; depth: number }[],
        color: string,
      ) => {
        for (let i = 0; i < strand.length; i++) {
          const p = strand[i];
          const r = 2.6 + p.depth * 3.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.4 + p.depth * 0.6;
          ctx.shadowBlur = 16 * p.depth;
          ctx.shadowColor = color;
          ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      };

      drawNodes(strandA, color1);
      drawNodes(strandB, color2);

      if (!reduced) {
        phase += speed;
        rafRef.current = requestAnimationFrame(render);
      }
    };

    if (reduced) {
      render(); // single still frame
    } else {
      rafRef.current = requestAnimationFrame(render);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [color1, color2, rungColor, speed]);

  return (
    <canvas
      ref={canvasRef}
      style={{ height, width: '100%' }}
      className={className}
      aria-hidden="true"
    />
  );
}
