"use client";
import { useEffect, useRef } from "react";

/**
 * Neon bar visualizer. Draws live frequency data from `analyser`; with no analyser it
 * breathes gently so the stream never shows a dead panel.
 */
export function Visualizer({
  analyser,
  bars = 48,
  className = "",
  hue = 275,
}: {
  analyser: AnalyserNode | null;
  bars?: number;
  className?: string;
  hue?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    const levels = new Float32Array(bars);
    let raf = 0;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (analyser && data) analyser.getByteFrequencyData(data);
      const gap = Math.max(2, w / bars / 4);
      const bw = (w - gap * (bars - 1)) / bars;

      for (let i = 0; i < bars; i++) {
        // Mirror around the centre so it reads as a waveform, not a spectrum analyser.
        const mirrored = Math.abs(i - (bars - 1) / 2) / (bars / 2);
        let target: number;
        if (data) {
          const bin = Math.floor((1 - mirrored) * data.length * 0.7);
          target = data[bin] / 255;
        } else {
          target = 0.08 + 0.06 * Math.sin(t / 600 + i * 0.35) * (1 - mirrored);
        }
        levels[i] += (target - levels[i]) * 0.25;
        const bh = Math.max(3, levels[i] * h * 0.95);
        const x = i * (bw + gap);
        const y = (h - bh) / 2;
        const grad = ctx.createLinearGradient(0, y, 0, y + bh);
        grad.addColorStop(0, `hsl(${hue + 30} 95% 75%)`);
        grad.addColorStop(0.5, `hsl(${hue} 90% 62%)`);
        grad.addColorStop(1, `hsl(${hue + 30} 95% 75%)`);
        ctx.fillStyle = grad;
        ctx.shadowColor = `hsl(${hue} 90% 60% / 0.8)`;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.roundRect(x, y, bw, bh, bw / 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser, bars, hue]);

  return <canvas ref={canvasRef} className={`block h-24 w-full ${className}`} aria-hidden />;
}
