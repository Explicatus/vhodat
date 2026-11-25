const https = (process.env.APP_URL ?? "").startsWith("https://");
// dev/тестови версии не трябва да се индексират от търсачките
const noindex = process.env.NOINDEX === "1";

/** Защитни заглавия за всички отговори (CSP се добавя в src/middleware.ts). */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS само при HTTPS: браузърът никога повече няма да отвори сайта по незащитена връзка
  ...(noindex ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : []),
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};
export default nextConfig;
