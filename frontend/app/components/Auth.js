"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";
// ✏️ Registration fields: [name, label, input type]. Backend expects these exact names.
const FIELDS = [["name", "Full name"], ["whatsapp", "Your WhatsApp number", "tel"],
  ["group_no", "Group number", "number"], ["roll", "College roll"], ["email", "Email", "email"], ["password", "Password (10+ chars)", "password"], ["confirm", "Confirm password", "password"]];
// Cloudflare Turnstile bot check (free). Adds a hidden "cf-turnstile-response" field to the form. Disabled if no site key is set.
const SITEKEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
function Captcha({ resetKey }) {
  const ref = useRef();
  useEffect(() => {
    if (!SITEKEY) return; let id, dead = false;
    const draw = () => { if (!dead && window.turnstile) id = window.turnstile.render(ref.current, { sitekey: SITEKEY, theme: "dark" }); };
    if (window.turnstile) draw(); else { let s = document.getElementById("cf"); if (!s) { s = document.createElement("script"); s.id = "cf"; s.async = true; s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; document.head.appendChild(s); } s.addEventListener("load", draw); }
    return () => { dead = true; if (id !== undefined && window.turnstile) window.turnstile.remove(id); };
  }, [resetKey]);
  return <div ref={ref} style={{ margin: "12px 0" }} />;
}

export default function Auth({ mode, setMode, onClose }) {
  const [err, setErr] = useState(""), [done, setDone] = useState(false), [busy, setBusy] = useState(false), [want, setWant] = useState(false), [tries, setTries] = useState(0), router = useRouter();
  async function submit(e) {
    e.preventDefault(); setErr(""); setBusy(true); const f = new FormData(e.target);
    try {
      if (mode === "login") { await api("/login", { method: "POST", json: Object.fromEntries(f) }); router.push("/portal"); return; }
      if (f.get("password") !== f.get("confirm")) throw Error("Passwords do not match");
      await api("/register", { method: "POST", body: f }); setDone(true);
    } catch (x) { setErr(x.message); setTries(n => n + 1); }   // new bot-check token after any failure
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
        <label>Photo in college dress (JPG/PNG/WebP, max 3MB)<input name="photo" type="file" accept="image/*" required /></label>
        {/* optional: apply to become an admin; the super admin reviews it */}
        <label className="chk"><input type="checkbox" name="apply_admin" value="1" onChange={e => setWant(e.target.checked)} /> I also want to apply to be an admin</label>
        {want && <label>Why should you be selected? (20+ characters)<textarea name="admin_reason" minLength={20} maxLength={1000} required /></label>}</>}
      <Captcha resetKey={mode + tries} />
      <button className="btn" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Enter the portal" : "Submit for approval"}</button>
      {err && <p className="err">{err}</p>}
    </form>}
  </div></div>);
}
