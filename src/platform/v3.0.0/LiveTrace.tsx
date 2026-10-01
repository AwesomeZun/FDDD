import { useEffect, useRef } from "react";
/** A bounded history of observed values, cleared when the selected individual changes. */
export function LiveTrace({
  value,
  tick,
  identity,
}: {
  value?: number;
  tick?: number;
  identity: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    rows = useRef<number[]>([]),
    last = useRef(-1);
  useEffect(() => {
    rows.current = [];
    last.current = -1;
  }, [identity]);
  useEffect(() => {
    if (value !== undefined && tick !== undefined && tick !== last.current) {
      rows.current.push(value);
      rows.current = rows.current.slice(-80);
      last.current = tick;
    }
    const el = canvas.current!,
      ctx = el.getContext("2d")!;
    const paint = () => {
      const w = el.clientWidth,
        h = el.clientHeight,
        d = Math.min(devicePixelRatio, 2);
      el.width = w * d;
      el.height = h * d;
      ctx.scale(d, d);
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#18312f";
      ctx.lineWidth = 0.6;
      for (let y = 8; y < h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const a = rows.current;
      if (a.length < 2) return;
      const max = Math.max(...a, 1) * 1.12;
      ctx.strokeStyle = "#74f5ce";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      a.forEach((v, i) => {
        const x = (i / 79) * w,
          y = h - 5 - (v / max) * (h - 12);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.stroke();
    };
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, tick, identity]);
  return (
    <canvas
      ref={canvas}
      className="live-trace"
      role="img"
      aria-label="Recent spike counts from the selected fly's computed steps"
    />
  );
}
