// Security headers for every page. (API proxying lives in middleware.js.)
const csp = ["default-src 'self'", "img-src 'self' data:", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src https://fonts.gstatic.com",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com", "frame-src https://challenges.cloudflare.com", "connect-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join("; ");
module.exports = {
  poweredByHeader: false,
  async headers() {
    const h = [{ key: "X-Frame-Options", value: "DENY" }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }, { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }];
    if (process.env.NODE_ENV === "production") h.push({ key: "Content-Security-Policy", value: csp });
    return [{ source: "/(.*)", headers: h }];
  },
};
