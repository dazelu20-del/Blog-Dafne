const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateUsername(username: string): ValidationResult {
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      errors: ["Username must be 3-30 letters, digits, or underscores."],
    };
  }
  return { ok: true, errors: [] };
}

export function validateEmail(email: string): ValidationResult {
  if (!EMAIL_RE.test(email)) {
    return { ok: false, errors: ["Please enter a valid email address."] };
  }
  return { ok: true, errors: [] };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) {
    return { ok: false, errors: ["Password must be at least 8 characters."] };
  }
  return { ok: true, errors: [] };
}

export function validateTitle(title: string): ValidationResult {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, errors: ["Title cannot be empty."] };
  if (trimmed.length > 200) {
    return { ok: false, errors: ["Title must be at most 200 characters."] };
  }
  return { ok: true, errors: [] };
}

export function validateBody(body: string): ValidationResult {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, errors: ["Body cannot be empty."] };
  if (trimmed.length > 20000) {
    return { ok: false, errors: ["Body must be at most 20000 characters."] };
  }
  return { ok: true, errors: [] };
}

export function validateComment(body: unknown): ValidationResult {
  if (typeof body !== "string") {
    return { ok: false, errors: ["Comment must be text."] };
  }
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, errors: ["Comment cannot be empty."] };
  if (trimmed.length > 2000) {
    return { ok: false, errors: ["Comment must be at most 2000 characters."] };
  }
  return { ok: true, errors: [] };
}

export function validateReactionKind(kind: unknown): ValidationResult {
  if (kind !== "like" && kind !== "dislike") {
    return {
      ok: false,
      errors: ["Reaction must be 'like' or 'dislike'."],
    };
  }
  return { ok: true, errors: [] };
}

export function normalizeSearchQuery(q: string | undefined): string {
  return (q || "").trim().slice(0, 100);
}
