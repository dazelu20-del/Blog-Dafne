import { getSecretKey } from "./utils";

const CSRF_COOKIE = "csrf_token";

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(sig);
}

export async function generateCsrfToken(secret: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toHex(bytes.buffer);
  const sig = await hmacSign(secret, token);
  return `${token}.${sig}`;
}

export async function validateCsrfToken(
  secret: string,
  token: string | null | undefined
): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const raw = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmacSign(secret, raw);
  if (sig.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export function getCsrfFromRequest(c: {
  req: {
    header: (name: string) => string | undefined;
    parseBody: () => Promise<Record<string, unknown>>;
  };
}): Promise<string | null> {
  return (async () => {
    const header = c.req.header("X-CSRF-Token");
    if (header) return header;
    const contentType = c.req.header("Content-Type") || "";
    if (contentType.includes("application/json")) return null;
    try {
      const body = await c.req.parseBody();
      const token = body["csrf_token"];
      return typeof token === "string" ? token : null;
    } catch {
      return null;
    }
  })();
}

export { CSRF_COOKIE };

export function csrfCookieOptions(secure: boolean): string {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function ensureCsrfCookie(
  secret: string,
  existing: string | undefined,
  secure: boolean
): Promise<{ token: string; setCookie: string | null }> {
  if (existing && (await validateCsrfToken(secret, existing))) {
    return { token: existing, setCookie: null };
  }
  const token = await generateCsrfToken(secret);
  const setCookie = `${CSRF_COOKIE}=${token}; ${csrfCookieOptions(secure)}`;
  return { token, setCookie };
}

export function getSecret(env: { SECRET_KEY?: string }): string {
  return getSecretKey(env);
}
