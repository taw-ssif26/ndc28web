// One helper for every backend call. Errors come back as readable messages.
export async function api(path, { method = "GET", json, body } = {}) {
  let r;
  try {
    r = await fetch("/api" + path, { method, credentials: "same-origin", body: json ? JSON.stringify(json) : body,
      headers: { "X-Req": "1", ...(json ? { "Content-Type": "application/json" } : {}) } });
  } catch { throw Error("Cannot reach the server (it may be waking up — try again in a minute)"); }
  const d = await r.json().catch(() => null);
  if (!r.ok) throw Error(d && typeof d.detail === "string" ? d.detail : `Server error ${r.status}`);
  return d;
}
