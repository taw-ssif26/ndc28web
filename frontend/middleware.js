// Proxies /api and /media to the Python backend and adds a secret header + the real visitor IP.
// The backend rejects any request without the secret, so bots can't bypass this site by hitting Render directly.
import { NextResponse } from "next/server";
export const config = { matcher: ["/api/:path*", "/media/:path*"] };
export function middleware(req) {
  const h = new Headers(req.headers);
  h.set("x-proxy-key", process.env.PROXY_KEY || "");
  h.set("x-client-ip", req.headers.get("x-real-ip") || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim());
  const dest = new URL(req.nextUrl.pathname + req.nextUrl.search, process.env.API_URL || "http://localhost:8000");
  return NextResponse.rewrite(dest, { request: { headers: h } });
}
