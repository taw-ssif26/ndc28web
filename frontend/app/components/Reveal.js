"use client";
import { useEffect, useRef } from "react";
// Fades children in when scrolled into view.
export default function Reveal({ children, className = "" }) {
  const r = useRef();
  useEffect(() => { const o = new IntersectionObserver(([e]) => e.isIntersecting && (r.current.classList.add("in"), o.disconnect()), { threshold: .15 }); o.observe(r.current); return () => o.disconnect(); }, []);
  return <div ref={r} className={`rv ${className}`}>{children}</div>;
}
