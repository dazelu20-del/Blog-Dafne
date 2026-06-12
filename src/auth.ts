import type { D1Database } from "@cloudflare/workers-types";
import type { User } from "./types";
import { withForeignKeys } from "./db";
import { getSecretKey } from "./utils";

const SESSION_COOKIE = "session";
const PBKDF2_ITERATIONS = 100000;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    key,
    256
  );
  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${toBase64(salt)}:${toBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
  const iterations = parseInt(parts[2], 10);
  const salt = fromBase64(parts[3]);
  const expected = fromBase64(parts[4]);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    key,
    256
  );
  const derived = new Uint8Array(bits);
  if (derived.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < derived.length; i++) {
    mismatch |= derived[i] ^ expected[i];
  }
  return mismatch === 0;
}

async function signSession(secret: string, userId: number): Promise<string> {
  const payload = `${userId}.${Date.now()}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const sigHex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${sigHex}`;
}

async function verifySession(
  secret: string,
  cookie: string | undefined
): Promise<number | null> {
  if (!cookie) return null;
  const lastDot = cookie.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = cookie.slice(0, lastDot);
  const sig = cookie.slice(lastDot + 1);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const expected = [...new Uint8Array(expectedBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;
  const userId = parseInt(payload.split(".")[0], 10);
  return Number.isFinite(userId) ? userId : null;
}

export function sessionCookieOptions(secure: boolean): string {
  const parts = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function createSessionCookie(
  secret: string,
  userId: number,
  secure: boolean
): Promise<string> {
  const value = await signSession(secret, userId);
  return `${SESSION_COOKIE}=${value}; ${sessionCookieOptions(secure)}`;
}

export function clearSessionCookie(secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function getUserIdFromSession(
  secret: string,
  cookieHeader: string | undefined
): Promise<number | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  return verifySession(secret, match?.[1]);
}

export async function createUser(
  db: D1Database,
  username: string,
  email: string,
  passwordHash: string
): Promise<number> {
  return withForeignKeys(db, async () => {
    const result = await db
      .prepare(
        "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
      )
      .bind(username, email.toLowerCase(), passwordHash)
      .run();
    return Number(result.meta.last_row_id);
  });
}

export async function getUserByUsername(
  db: D1Database,
  username: string
): Promise<User | null> {
  return withForeignKeys(db, async () => {
    return db
      .prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE")
      .bind(username)
      .first<User>();
  });
}

export async function getUserById(
  db: D1Database,
  id: number
): Promise<User | null> {
  return withForeignKeys(db, async () => {
    return db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
  });
}

export async function authenticateUser(
  db: D1Database,
  username: string,
  password: string
): Promise<User | null> {
  const user = await getUserByUsername(db, username);
  if (!user) return null;
  const ok = await verifyPassword(password, user.password_hash);
  return ok ? user : null;
}

export function getAuthSecret(env: { SECRET_KEY?: string }): string {
  return getSecretKey(env);
}
