export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncatePreview(text: string, maxWords = 150): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return words.slice(0, maxWords).join(" ") + "...";
}

export function escapeLikePattern(query: string): string {
  return query.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function isSafeRedirect(path: string | undefined | null): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return false;
  }
  return true;
}

export function getSecretKey(env: { SECRET_KEY?: string }): string {
  return env.SECRET_KEY || "dev";
}

export function isSecureRequest(url: URL): boolean {
  return url.protocol === "https:";
}
