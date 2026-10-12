"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
// ✏️ Registration fields: [name, label, input type]. Backend expects these exact names.
const FIELDS = [["name", "Full name"], ["father", "Father's name"], ["mother", "Mother's name"], ["parent_phone", "Parent's phone", "tel"], ["whatsapp", "Your WhatsApp number", "tel"],
  ["group_no", "Group number", "number"], ["roll", "College roll"], ["email", "Email", "email"], ["password", "Password (8+ chars)", "password"], ["confirm", "Confirm password", "password"]];
export default function Auth({ mode, setMode, onClose }) {
  const [err, setErr] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false), router = useRouter();
  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true); const f = new FormData(e.target);
    try {
      if (mode === "login") { await api("/login", { method: "POST", json: Object.fromEntries(f) }); router.push("/portal"); return; }
      if (f.get("password") !== f.get("confirm")) throw Error("Passwords do not match");
      await api("/register", { method: "POST", body: f }); setDone(true);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }
  return (<div className="modal" onClick={onClose}><div className="box" onClick={e => e.stopPropagation()}>
    <div className="tabs"><button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Log in</button><button className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Register</button><button onClick={onClose}>✕</button></div>
    {done ? <p className="ok">Registration received. An admin will review it — you can log in once approved.</p> :
    <form onSubmit={submit}>
      {mode === "login" ? <>
        <label>Email, roll or WhatsApp<input name="id" required autoComplete="username" /></label>
        <label>Password<input name="password" type="password" required autoComplete="current-password" /></label></> :
      <><div className="two">{FIELDS.map(([n, l, t = "text"]) => <label key={n}>{l}<input name={n} type={t} required /></label>)}</div>
        <label>Photo in college dress (JPG/PNG/WebP, max 3MB)<input name="photo" type="file" accept="image/*" required /></label></>}
      <button className="btn" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Enter the portal" : "Submit for approval"}</button>
      {err && <p className="err">{err}</p>}
    </form>}
  </div></div>);
}
