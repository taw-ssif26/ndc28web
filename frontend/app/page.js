"use client";
import { useEffect, useRef, useState } from "react";
import { SITE, PHRASES, TIMELINE, CLUBS, FEATURES } from "./config";
import { api } from "./lib/api";
import Loader from "./components/Loader";
import Motes from "./components/Motes";
import Reveal from "./components/Reveal";
import Auth from "./components/Auth";

// PUBLIC LANDING PAGE — sections are in order top to bottom; each is a <section>.
export default function Home() {
  const [intro, setIntro] = useState(true), [auth, setAuth] = useState(null), [photos, setPhotos] = useState([]), [ph, setPh] = useState(0), title = useRef();
  useEffect(() => { const t = setTimeout(() => setIntro(false), 2200); return () => clearTimeout(t); }, []);
  useEffect(() => { api("/gallery").then(setPhotos).catch(() => {}); const i = setInterval(() => setPh(p => (p + 1) % PHRASES.length), 2600); return () => clearInterval(i); }, []);
  // The gold title is revealed only under the cursor (a torch of "light").
  const torch = e => { const r = title.current.getBoundingClientRect(); title.current.style.setProperty("--mx", e.clientX - r.left + "px"); title.current.style.setProperty("--my", e.clientY - r.top + "px"); };
  return (<>
    {intro && <Loader kind="intro" />}
    <nav className="top"><span className="brand"><img src="/logo.svg" alt="NDC crest" /> {SITE.name}</span>
      <span><button className="ghost" onClick={() => setAuth("login")}>Log in</button> <button className="btn" onClick={() => setAuth("register")}>Register</button></span></nav>

    <header className="hero" onPointerMove={torch}>
      <Motes />
      <p className="kick">{SITE.college} · Est. 1949</p>
      <h1 className="mega" ref={title} data-t="BATCH 28">BATCH 28</h1>
      <p className="phrase" key={ph}>{PHRASES[ph]}</p>
      <button className="btn lg" onClick={() => setAuth("register")}>Join the batch</button>
      <span className="hint">move your cursor — chase the light</span>
    </header>

    <div className="marquee"><div>{[...CLUBS, ...CLUBS].map((c, i) => <span key={i}>✦ {c}</span>)}</div></div>

    <section className="wrap"><Reveal><h2>Seventy-seven years of light</h2></Reveal>
      <div className="tl">{TIMELINE.map(([y, t]) => <Reveal key={y} className="tli"><b>{y}</b><p>{t}</p></Reveal>)}</div></section>

    <section className="wrap"><Reveal><h2>Your batch, one tap away</h2></Reveal>
      <div className="bento">{FEATURES.map(([i, t, d]) => <Reveal key={t} className="card"><span className="ico">{i}</span><h3>{t}</h3><p>{d}</p></Reveal>)}</div>
      <p className="lock">Members only · every registration is reviewed by an admin</p></section>

    <section className="wrap"><Reveal><h2>Gallery</h2></Reveal>
      <div className="mason">{photos.length ? photos.map(g => <img key={g.id} src={`/media/${g.file}`} alt={g.caption || "Batch 28"} loading="lazy" />) : <p>Photos coming soon.</p>}</div></section>

    <section className="wrap"><Reveal className="card dev"><h3>Built by {SITE.dev.name}</h3><p>Self-taught full-stack developer — Python, Next.js, PostgreSQL and AI systems.</p><br />
      <a className="btn" target="_blank" rel="noopener" href={SITE.dev.url}>{SITE.dev.url.replace("https://", "")} ↗</a></Reveal></section>
    <footer>© Batch 28 · {SITE.college} · <em>{SITE.motto}</em></footer>
    {auth && <Auth mode={auth} setMode={setAuth} onClose={() => setAuth(null)} />}
  </>);
}
