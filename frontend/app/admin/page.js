"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

// ADMIN PANEL — deliberately has NO loading screens. Edit FIELDS to change what admins can enter.
// field = [name, label, type]; type may be "textarea" or "select:a,b,c"
const FIELDS = {
  events: [["title", "Title"], ["starts", "Starts", "datetime-local"], ["ends", "Ends", "datetime-local"], ["location", "Location"], ["link", "Link", "url"], ["details", "Details", "textarea"]],
  notices: [["title", "Title"], ["category", "Category", "select:General,Exam,Urgent,Event,Academic"], ["pinned", "Pinned (0 or 1)", "select:0,1"], ["body", "Body", "textarea"]],
  resources: [["title", "Title"], ["kind", "Type", "select:PDF,Video,Doc,Link,Slides,Other"], ["url", "URL", "url"], ["description", "Description", "textarea"]],
  groups: [["no", "Group number", "number"], ["link", "WhatsApp invite link", "url"]],
};
const USER_FIELDS = [["name", "Name"], ["whatsapp", "WhatsApp"], ["group_no", "Group", "number"], ["roll", "Roll"],
  ["email", "Email", "email"], ["role", "Role", "select:student,admin"], ["status", "Status", "select:pending,approved,rejected"], ["password", "New password (optional, 10+)", "password"]];

function Field({ f, v }) {
  const [n, l, t = "text"] = f;
  return <label>{l}{t === "textarea" ? <textarea name={n} defaultValue={v ?? ""} /> : t.startsWith("select:")
    ? <select name={n} defaultValue={v ?? ""}>{t.slice(7).split(",").map(o => <option key={o}>{o}</option>)}</select> : <input name={n} type={t} defaultValue={v ?? ""} />}</label>;
}

// Generic list + add/edit form for events, notices, resources, groups.
function Crud({ t }) {
  const [rows, setRows] = useState([]), [edit, setEdit] = useState(null), [err, setErr] = useState("");
  const load = useCallback(() => api("/c/" + t).then(setRows).catch(e => setErr(e.message)), [t]);
  useEffect(() => { setEdit(null); load(); }, [load]);
  async function save(e) { e.preventDefault(); setErr("");
    try { const o = Object.fromEntries(new FormData(e.target)); await api(`/c/${t}${edit?.id ? "/" + edit.id : ""}`, { method: edit?.id ? "PUT" : "POST", json: o }); setEdit(null); e.target.reset(); load(); } catch (x) { setErr(x.message); } }
  return (<div className="split"><div className="cards">{rows.map(r => <div className="card" key={r.id}><b>{r.title || "Group " + r.no}</b><small>{r.link || r.url || r.category}</small>
      <button onClick={() => setEdit(r)}>Edit</button><button onClick={async () => { if (confirm("Delete?")) { await api(`/c/${t}/${r.id}`, { method: "DELETE" }); load(); } }}>Delete</button></div>)}
      {!rows.length && <p>Nothing yet.</p>}</div>
    <form className="card" key={edit?.id || "new"} onSubmit={save}><h3>{edit ? "Edit" : "Add"}</h3>{FIELDS[t].map(f => <Field key={f[0]} f={f} v={edit?.[f[0]]} />)}<button className="btn">Save</button>{edit && <button type="button" onClick={() => setEdit(null)}>Cancel</button>}{err && <p className="err">{err}</p>}</form></div>);
}

function Users({ me }) {
  const [rows, setRows] = useState([]), [edit, setEdit] = useState(null), [err, setErr] = useState("");
  const load = useCallback(() => api("/admin/users").then(setRows).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const run = async fn => { try { await fn(); load(); } catch (x) { setErr(x.message); } };
  const status = (id, s) => run(() => api(`/admin/users/${id}/status`, { method: "POST", json: { status: s } }));
  return (<div>{err && <p className="err">{err}</p>}<div className="cards">{rows.map(u => <div className="card" key={u.id}><div className="row">{u.role !== "super" && <img className="av" src={`/api/photo/${u.id}`} alt="" />}
      <div><b>{u.name}</b> <em className={`st-${u.status}`}>{u.status} · {u.role}</em><small>Roll {u.roll} · Group {u.group_no} · {u.whatsapp} · {u.email}</small></div></div>
      {u.role === "student" && u.status !== "approved" && <button onClick={() => status(u.id, "approved")}>Approve</button>}
      {u.role === "student" && u.status !== "rejected" && <button onClick={() => status(u.id, "rejected")}>Reject</button>}
      {me.role === "super" && u.role !== "super" && <><button onClick={() => setEdit(u)}>Edit</button><button onClick={() => confirm("Delete permanently?") && run(() => api("/admin/users/" + u.id, { method: "DELETE" }))}>Delete</button></>}</div>)}</div>
    {edit && <form className="card" key={edit.id} onSubmit={e => { e.preventDefault(); run(async () => { await api("/admin/users/" + edit.id, { method: "PATCH", json: Object.fromEntries(new FormData(e.target)) }); setEdit(null); }); }}>
      <h3>Edit {edit.name}</h3>{USER_FIELDS.map(f => <Field key={f[0]} f={f} v={edit[f[0]]} />)}<button className="btn">Save</button><button type="button" onClick={() => setEdit(null)}>Cancel</button></form>}</div>);
}

// Super admin only: review "I want to be an admin" applications.
function Requests() {
  const [rows, setRows] = useState([]), [err, setErr] = useState("");
  const load = useCallback(() => api("/super/admin-requests").then(setRows).catch(e => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id, decision) => { setErr(""); try { await api("/super/admin-requests/" + id, { method: "POST", json: { decision } }); load(); } catch (x) { setErr(x.message); } };
  return (<div className="cards">{err && <p className="err">{err}</p>}{rows.map(r => <div className="card" key={r.id}>
    <div className="row"><img className="av" src={`/api/photo/${r.user_id}`} alt="" /><div><b>{r.name}</b> <em className={`st-${r.status}`}>{r.status}</em><small>Roll {r.roll} · Group {r.group_no} · {r.whatsapp} · registration {r.user_status}</small></div></div>
    <p style={{ whiteSpace: "pre-wrap", color: "var(--iv)" }}>{r.reason}</p>
    {r.status === "pending" && <><button onClick={() => decide(r.id, "approved")}>Make admin</button><button onClick={() => decide(r.id, "rejected")}>Decline</button></>}</div>)}
    {!rows.length && <p>No applications yet.</p>}</div>);
}

function Gallery() {
  const [rows, setRows] = useState([]), [err, setErr] = useState("");
  const load = useCallback(() => api("/gallery").then(setRows), []);
  useEffect(() => { load(); }, [load]);
  async function up(e) { e.preventDefault(); setErr(""); try { await api("/gallery", { method: "POST", body: new FormData(e.target) }); e.target.reset(); load(); } catch (x) { setErr(x.message); } }
  return (<div className="split"><div className="mason">{rows.map(g => <figure key={g.id}><img src={`/media/${g.file}`} alt={g.caption || ""} />{g.caption && <figcaption>{g.caption}</figcaption>}<button onClick={async () => { await api("/gallery/" + g.id, { method: "DELETE" }); load(); }}>Delete</button></figure>)}</div>
    <form className="card" onSubmit={up}><h3>Upload photo</h3><label>Caption<input name="caption" /></label><label>Image<input name="file" type="file" accept="image/*" required /></label><button className="btn">Upload</button>{err && <p className="err">{err}</p>}</form></div>);
}

function Database() {
  const [s, setS] = useState(null), load = () => api("/super/stats").then(setS); useEffect(() => { load(); }, []); if (!s) return null;
  // clean-up tools for spam/bot registrations
  const purge = async (what, msg) => { if (!confirm(msg)) return; try { const r = await api("/super/purge", { method: "POST", json: { what } }); alert(`Deleted ${r.deleted}`); load(); } catch (x) { alert(x.message); } };
  return (<><div className="bento">{[["Pending", s.users.pending || 0], ["Approved", s.users.approved || 0], ["Rejected", s.users.rejected || 0], ["Events", s.events], ["Notices", s.notices], ["Resources", s.resources], ["Photos", s.gallery], ["Groups", s.groups]]
    .map(([l, n]) => <div className="card" key={l}><span className="tag">{l}</span><div className="big">{n}</div></div>)}</div><br /><a className="btn" href="/api/super/export.csv">Download users CSV</a>
    <div className="card" style={{ marginTop: 18 }}><h3>Clean-up</h3><p>Use after spam or a bot attack.</p><br />
      <button onClick={() => purge("pending", "Delete ALL students still waiting for approval (including genuine ones)? This cannot be undone.")}>Delete all pending registrations</button>
      <button onClick={() => purge("orphans", "Delete unused photos and old rate-limit rows?")}>Clean unused photos</button></div></>);
}

export default function Admin() {
  const [me, setMe] = useState(null), [tab, setTab] = useState("users"), router = useRouter();
  useEffect(() => { api("/me").then(m => m.role === "student" ? router.replace("/portal") : setMe(m)).catch(() => router.replace("/")); }, [router]);
  if (!me) return null;
  const tabs = [["users", "Approvals & users"], ["events", "Events"], ["notices", "Notices"], ["resources", "Resources"], ["groups", "WhatsApp groups"], ["gallery", "Gallery"], ...(me.role === "super" ? [["requests", "Admin applications"], ["db", "Database"]] : [])];
  return (<div className="admin"><header><b>Admin · {me.name} ({me.role})</b><a href="/portal">← Portal</a></header>
    <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
    {tab === "users" ? <Users me={me} /> : tab === "gallery" ? <Gallery /> : tab === "db" ? <Database /> : tab === "requests" ? <Requests /> : <Crud t={tab} />}</div>);
}
