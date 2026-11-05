import { NextResponse, type NextRequest } from "next/server";

/**
 * Content-Security-Policy с nonce: всяка заявка получава случаен код и браузърът
 * изпълнява само скриптове с него. Next.js автоматично слага nonce-а на своите скриптове.
 * Така дори при пропуск в кода (XSS) вмъкнат скрипт няма да се изпълни.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const https = (process.env.APP_URL ?? "").startsWith("https://");

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // атрибутите style="…" (ширини на ленти и т.н.) изискват 'unsafe-inline' за стиловете
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    // формите може да пренасочат само към нас и към страниците за плащане на Stripe
    "form-action 'self' https://checkout.stripe.com https://connect.stripe.com https://billing.stripe.com",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // всички страници, без статичните файлове и API-тата (те не връщат HTML)
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
