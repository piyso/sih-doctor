import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isRecording: boolean;
  color?: string;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isRecording,
  color = '#10b981',
  height = 52
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    // Handle High-DPI Displays (Apple Retina)
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const isDarkMode = document.documentElement.classList.contains('dark');
    const restingStroke = isDarkMode ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.45)';

    const curves = [
      { color: isDarkMode ? 'rgba(56, 189, 248, 0.85)' : 'rgba(2, 132, 199, 0.85)', speed: 0.08, widthFactor: 1.0 },   // Sapphire Blue
      { color: color || (isDarkMode ? 'rgba(52, 211, 153, 0.90)' : 'rgba(16, 185, 129, 0.90)'), speed: -0.06, widthFactor: 1.3 }, // Vitals Green
      { color: isDarkMode ? 'rgba(129, 140, 248, 0.75)' : 'rgba(99, 102, 241, 0.75)', speed: 0.10, widthFactor: 0.8 },  // Indigo
    ];

    const K = 4.0; // Cauchy-Lorentzian attenuation constant

    const render = () => {
      const w = rect.width;
      const h = height;
      const midY = h / 2;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      if (!isRecording) {
        // Idle Resting Horizon Line (Clean slate)
        ctx.beginPath();
        ctx.strokeStyle = restingStroke;
        ctx.lineWidth = 1.5;
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.stroke();

        animationId = requestAnimationFrame(render);
        return;
      }

      curves.forEach((curve) => {
        ctx.beginPath();
        ctx.strokeStyle = curve.color;
        ctx.lineWidth = 2.0;

        for (let px = 0; px <= w; px += 3) {
          const x = ((px / w) * 2 - 1) * 3;
          const att = Math.pow(K / (K + Math.pow(x, 2)), K);
          const wave = Math.sin(x * curve.widthFactor * 2.2 + phase * curve.speed * 10) *
                       Math.cos(x * 0.9 - phase * 0.5);

          const y = midY + wave * (h * 0.38) * att;

          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
      });

      phase += 0.025;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isRecording, color, height]);

  return (
    <div
      className="w-full rounded-xl bg-muted/40 border border-border/80 flex items-center px-3 overflow-hidden"
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: `${height}px` }}
      />
    </div>
  );
};
