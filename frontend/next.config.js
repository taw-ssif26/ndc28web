// Browser -> Next (same origin) -> Python API. Keeps login cookies working. Set API_URL in Vercel (your Render URL).
const API = process.env.API_URL || "http://localhost:8000";
module.exports = {
  async rewrites() { return [{ source: "/api/:p*", destination: `${API}/api/:p*` }, { source: "/media/:p*", destination: `${API}/media/:p*` }]; },
  async headers() { return [{ source: "/(.*)", headers: [{ key: "X-Frame-Options", value: "DENY" }, { key: "X-Content-Type-Options", value: "nosniff" }] }]; },
};
