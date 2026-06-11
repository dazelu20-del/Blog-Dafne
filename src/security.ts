export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": "default-src 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

export function withSecurityHeaders(headers: HeadersInit = {}): Headers {
  const h = new Headers(headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    h.set(key, value);
  }
  return h;
}

export function htmlResponse(body: string, init: ResponseInit = {}): Response {
  const headers = withSecurityHeaders(init.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(body, { ...init, headers });
}

export function jsonResponse(data: unknown, status = 200): Response {
  const headers = withSecurityHeaders({ "Content-Type": "application/json" });
  return new Response(JSON.stringify(data), { status, headers });
}

export function redirectResponse(
  location: string,
  init: ResponseInit = {}
): Response {
  const headers = withSecurityHeaders(init.headers);
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name) out[name] = rest.join("=");
  }
  return out;
}

export function appendSetCookie(
  headers: Headers,
  cookie: string | null | undefined
): void {
  if (cookie) headers.append("Set-Cookie", cookie);
}
