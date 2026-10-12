"use client";
import { useEffect, useRef } from "react";
// Golden dust that drifts upward and gathers around your cursor: "light" for the motto.
export default function Motes() {
  const ref = useRef();
  useEffect(() => {
    const c = ref.current, x = c.getContext("2d"); let w, h, ps = [], m = { x: -999, y: -999 }, raf;
    const size = () => { w = c.width = c.offsetWidth; h = c.height = c.offsetHeight;
      ps = Array.from({ length: Math.min(140, w / 9) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .3, vy: -Math.random() * .4 - .1, r: Math.random() * 1.8 + .4 })); };
    const mv = e => { const r = c.getBoundingClientRect(); m = { x: e.clientX - r.left, y: e.clientY - r.top }; };
    size(); addEventListener("mousemove", mv); addEventListener("resize", size);
    const tick = () => { x.clearRect(0, 0, w, h);
      for (const p of ps) { const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d < 200) { p.vx += dx / d * .04; p.vy += dy / d * .04; }
        p.x += p.vx; p.y += p.vy; p.vx *= .99; if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w; } if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fillStyle = `rgba(212,175,106,${d < 200 ? .95 : .45})`; x.shadowBlur = 8; x.shadowColor = "#d4af6a"; x.fill(); }
      raf = requestAnimationFrame(tick); };
    tick(); return () => { cancelAnimationFrame(raf); removeEventListener("mousemove", mv); removeEventListener("resize", size); };
  }, []);
  return <canvas ref={ref} className="motes" />;
}
