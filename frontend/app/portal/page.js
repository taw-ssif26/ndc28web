"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
import Loader from "../components/Loader";

// STUDENT PORTAL — one page, tabs on the left. A loader plays on every tab change (students only).
const TABS = [["dash", "Home"], ["events", "Events"], ["notices", "Notices"], ["community", "Community"], ["resources", "Resources"], ["gallery", "Gallery"]];
const when = s => s ? new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "";
const Link = ({ href, children }) => href ? <a className="btn" target="_blank" rel="noopener noreferrer" href={href}>{children} ↗</a> : null;

function Event({ x }) { const n = Date.now(), s = new Date(x.ends || x.starts) < n ? "Past" : new Date(x.starts) > n ? "Upcoming" : "Ongoing";
  return <div className="card"><span className="tag">{s} · {when(x.starts)}</span><h3>{x.title}</h3><p>{x.location}</p><p>{x.details}</p><br /><Link href={x.link}>Details</Link></div>; }
function Notice({ x }) { return <details className={`card ${x.pinned ? "pin" : ""}`}><summary><span className="tag">{x.pinned ? "📌 " : ""}{x.category}</span><h3>{x.title}</h3></summary><p style={{ whiteSpace: "pre-wrap" }}>{x.body}</p></details>; }

function Tab({ tab, me }) {
  const [d, setD] = useState(null);
  useEffect(() => { const path = { dash: "/c/notices", events: "/c/events", notices: "/c/notices", community: "/community", resources: "/c/resources", gallery: "/gallery" }[tab]; api(path).then(setD).catch(e => setD({ error: e.message })); }, [tab]);
  if (!d) return null; if (d.error) return <p className="err">{d.error}</p>;
  if (tab === "dash") return <><div className="bento"><div className="card"><span className="tag">Group</span><div className="big">{me.group_no}</div></div><div className="card"><span className="tag">Roll</span><div className="big">{me.roll}</div></div></div><h2>Latest notices</h2><div className="cards">{d.slice(0, 3).map(x => <Notice key={x.id} x={x} />)}</div></>;
  if (tab === "events") return <div className="cards">{d.map(x => <Event key={x.id} x={x} />)}{!d.length && <p>No events yet.</p>}</div>;
  if (tab === "notices") return <div className="cards">{d.map(x => <Notice key={x.id} x={x} />)}{!d.length && <p>No notices yet.</p>}</div>;
  if (tab === "community") return <div className="card"><span className="tag">Group {d.group}</span><h3>Your WhatsApp group</h3>{d.link ? <><br /><Link href={d.link}>Join on WhatsApp</Link></> : <p>Your group's link hasn't been added yet. Ask an admin.</p>}</div>;
  if (tab === "resources") return <div className="bento">{d.map(x => <div className="card" key={x.id}><span className="tag">{x.kind}</span><h3>{x.title}</h3><p>{x.description}</p><br /><Link href={x.url}>Open</Link></div>)}{!d.length && <p>No resources yet.</p>}</div>;
  return <div className="mason">{d.map(g => <img key={g.id} src={`/media/${g.file}`} alt={g.caption || "Batch 28"} loading="lazy" />)}</div>;
}

export default function Portal() {
  const [me, setMe] = useState(null), [tab, setTab] = useState("dash"), [busy, setBusy] = useState(true), router = useRouter();
  useEffect(() => { api("/me").then(setMe).catch(() => router.replace("/")); }, [router]);
  useEffect(() => { setBusy(true); const t = setTimeout(() => setBusy(false), 1000); return () => clearTimeout(t); }, [tab]);   // loader length (ms)
  if (!me) return <Loader kind="dash" />;
  return (<div className="shell">
    {busy && <Loader kind={tab} />}
    <aside><span className="brand"><img src="/logo.svg" alt="" /> Batch 28</span>
      {TABS.map(([k, l]) => <button key={k} className={`nv ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>)}
      {me.role !== "student" && <a className="nv" href="/admin">⚙ Admin panel</a>}
      <div className="me"><img className="av" src={`/api/photo/${me.id}`} alt="" /> {me.name}<br /><button className="ghost" onClick={async () => { await api("/logout", { method: "POST" }); router.replace("/"); }}>Log out</button></div></aside>
    <main><h1>{TABS.find(t => t[0] === tab)[1]}</h1><Tab tab={tab} me={me} /></main></div>);
}
