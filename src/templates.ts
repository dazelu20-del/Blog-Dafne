import type { Comment, Post } from "./types";
import { escapeHtml, truncatePreview } from "./utils";

/** Public site URL (no spaces — used after Cloudflare deploy). */
export const SITE_URL = "https://blog-dafne.dazelu20.workers.dev";

export interface LayoutOptions {
  title: string;
  user: { username: string } | null;
  csrfToken: string;
  body: string;
  extraHead?: string;
  extraScripts?: string;
}

function navLinks(user: { username: string } | null): string {
  const common = `<a href="/">🏠 home</a>
      <a href="/search">🔍 search</a>`;
  if (user) {
    return `${common}
      <a href="/new">✎ new look</a>
      <span class="nav-user">hey gorgeous, ${escapeHtml(user.username)} ~</span>
      <form class="nav-logout" method="post" action="/logout">
        <input type="hidden" name="csrf_token" value="{{CSRF}}">
        <button type="submit" class="btn btn-ghost">bye for now ~</button>
      </form>`;
  }
  return `${common}
      <a href="/login">♡ log in</a>
      <a href="/signup" class="btn btn-primary">join the glam ♡</a>`;
}

export function layout(opts: LayoutOptions): string {
  const nav = navLinks(opts.user).replace(/\{\{CSRF\}\}/g, escapeHtml(opts.csrfToken));
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="The fashion tips and trends coming right up">
  <link rel="canonical" href="${SITE_URL}/">
  <meta property="og:url" content="${SITE_URL}/">
  <meta property="og:site_name" content="The Fashion Web">
  <title>${escapeHtml(opts.title)} — The Fashion Web</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/style.css">
  ${opts.extraHead || ""}
</head>
<body>
  <div class="bow-field" aria-hidden="true">
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
    <span class="bow-float">🎀</span>
  </div>
  <header class="site-header">
    <div class="container header-inner">
      <a href="/" class="logo">🎀 The Fashion Web</a>
      <nav class="site-nav">${nav}</nav>
      <button type="button" id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">Theme</button>
    </div>
  </header>
  <main class="container">
    ${opts.body}
  </main>
  <footer class="site-footer">
    <div class="container">
      <p>&copy; 2026 The Fashion Web · stitched with bows &amp; love on Cloudflare Workers</p>
    </div>
  </footer>
  <script src="/theme.js"></script>
  ${opts.extraScripts || ""}
</body>
</html>`;
}

export function renderHome(
  posts: Post[],
  user: { username: string } | null,
  csrfToken: string
): string {
  const list =
    posts.length === 0
      ? `<div class="empty-state"><p>no looks yet, babe!</p><p class="muted">be the first to share something fabulous ~</p></div>`
      : `<div class="post-list">${posts.map(renderPostCard).join("")}</div>`;
  return layout({
    title: "Home",
    user,
    csrfToken,
    body: `<section class="page-header">
      <h1>Latest Posts</h1>
      <p class="muted">The fashion tips and trends coming right up</p>
      <p class="muted comment-hint">open a blog post to leave a comment ~</p>
    </section>
    ${list}`,
  });
}

function renderPostCard(post: Post): string {
  const preview = escapeHtml(truncatePreview(post.body));
  return `<article class="post-card">
    <h2><a href="/post/${post.id}">${escapeHtml(post.title)}</a></h2>
    <p class="post-meta">By ${escapeHtml(post.author || "unknown")} · ${escapeHtml(post.created_at)}</p>
    <p class="post-preview">${preview}</p>
    <a href="/post/${post.id}" class="read-more">peek inside</a>
  </article>`;
}

export function renderPostPage(
  post: Post,
  comments: Comment[],
  user: { username: string } | null,
  csrfToken: string,
  isAuthor: boolean
): string {
  const edited = post.updated_at
    ? `<span class="edited-badge">edited</span>`
    : "";
  const authorActions = isAuthor
    ? `<div class="author-actions">
        <a href="/edit/${post.id}" class="btn btn-ghost">restyle ✎</a>
        <form method="post" action="/delete/${post.id}" class="inline-form" id="delete-form">
          <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
          <button type="submit" class="btn btn-danger">remove 🥀</button>
        </form>
      </div>`
    : "";

  const commentsHtml =
    comments.length === 0
      ? `<p class="empty-state muted">no compliments yet ~ drop the first one?</p>`
      : `<ul class="comment-list" id="comment-list">${comments
          .map(
            (c) => `<li class="comment">
              <p class="comment-meta"><strong>${escapeHtml(c.author || "unknown")}</strong> · ${escapeHtml(c.created_at)}</p>
              <p class="comment-body">${escapeHtml(c.body)}</p>
            </li>`
          )
          .join("")}</ul>`;

  const commentForm = user
    ? `<form id="comment-form" class="comment-form">
        <label for="comment-body">drop a compliment ♡</label>
        <textarea id="comment-body" name="body" rows="3" maxlength="2000" required placeholder="omg obsessed with this look..."></textarea>
        <button type="submit" class="btn btn-primary">send love ♡</button>
        <p id="comment-error" class="form-error" hidden></p>
      </form>`
    : `<p class="muted">please <a href="/login?next=/post/${post.id}">log in</a> to comment on this blog post ~</p>`;

  return layout({
    title: post.title,
    user,
    csrfToken,
    extraScripts: `<script src="/post.js"></script>
<script>
  window.__POST__ = ${JSON.stringify({
    id: post.id,
    csrfToken,
    loggedIn: !!user,
  })};
</script>`,
    body: `<article class="post-detail">
      <header class="post-header">
        <h1>${escapeHtml(post.title)} ${edited}</h1>
        <p class="post-meta">By ${escapeHtml(post.author || "unknown")} · ${escapeHtml(post.created_at)}</p>
        ${authorActions}
      </header>
      <div class="post-body">${escapeHtml(post.body).replace(/\n/g, "<br>")}</div>
      <section class="comments-section">
        <h2>Compliment Corner</h2>
        <p class="muted comments-note">comments are only available on blog posts like this one ~</p>
        ${commentsHtml}
        ${commentForm}
      </section>
    </article>`,
  });
}

export function renderAuthForm(
  kind: "login" | "signup",
  csrfToken: string,
  user: null,
  errors: string[] = [],
  values: Record<string, string> = {},
  next?: string
): string {
  const title = kind === "login" ? "Log in" : "Sign up";
  const action = kind === "login" ? "/login" : "/signup";
  const nextField = next
    ? `<input type="hidden" name="next" value="${escapeHtml(next)}">`
    : "";
  const errorsHtml =
    errors.length > 0
      ? `<ul class="form-errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
      : "";

  const fields =
    kind === "signup"
      ? `<label for="username">pick a cute username ~</label>
         <input id="username" name="username" value="${escapeHtml(values.username || "")}" required pattern="[A-Za-z0-9_]{3,30}" maxlength="30" placeholder="e.g. softgirl_dafne">
         <label for="email">your email ♡</label>
         <input id="email" name="email" type="email" value="${escapeHtml(values.email || "")}" required placeholder="you@example.com">
         <label for="password">secret password ~</label>
         <input id="password" name="password" type="password" required minlength="8" placeholder="shhh...">`
      : `<label for="username">username ~</label>
         <input id="username" name="username" value="${escapeHtml(values.username || "")}" required placeholder="who's back?">
         <label for="password">password ~</label>
         <input id="password" name="password" type="password" required placeholder="shhh...">`;

  return layout({
    title,
    user,
    csrfToken,
    body: `<section class="auth-form">
      <h1>${title}</h1>
      ${errorsHtml}
      <form method="post" action="${action}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        ${nextField}
        ${fields}
        <button type="submit" class="btn btn-primary">${kind === "login" ? "welcome back ♡" : "join the glam ♡"}</button>
      </form>
    </section>`,
  });
}

export function renderPostForm(
  kind: "new" | "edit",
  csrfToken: string,
  user: { username: string },
  post?: Post,
  errors: string[] = []
): string {
  const title = kind === "new" ? "New Look" : "Restyle Look";
  const action = kind === "new" ? "/new" : `/edit/${post?.id}`;
  const errorsHtml =
    errors.length > 0
      ? `<ul class="form-errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`
      : "";

  return layout({
    title,
    user,
    csrfToken,
    body: `<section class="post-form">
      <h1>${title}</h1>
      ${errorsHtml}
      <form method="post" action="${action}">
        <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
        <label for="title">look title ~</label>
        <input id="title" name="title" value="${escapeHtml(post?.title || "")}" required maxlength="200" placeholder="e.g. pastel picnic outfit">
        <label for="body">the details ~</label>
        <textarea id="body" name="body" rows="12" required maxlength="20000" placeholder="spill the tea on this fit...">${escapeHtml(post?.body || "")}</textarea>
        <button type="submit" class="btn btn-primary">post look ♡</button>
      </form>
    </section>`,
  });
}

export function renderSearch(
  query: string,
  posts: Post[],
  user: { username: string } | null,
  csrfToken: string
): string {
  const results =
    query === ""
      ? `<p class="empty-state muted">Enter a search term to find your dream looks ~</p>`
      : posts.length === 0
        ? `<p class="empty-state muted">no matches babe ~ try another search?</p>`
        : `<div class="post-list">${posts.map(renderPostCard).join("")}</div>`;

  return layout({
    title: "Search",
    user,
    csrfToken,
    body: `<section class="search-page">
      <h1>Search</h1>
      <form method="get" action="/search" class="search-form">
        <label for="q">find your vibe ~</label>
        <input id="q" name="q" value="${escapeHtml(query)}" maxlength="100" placeholder="search outfits, trends, inspo...">
        <button type="submit" class="btn btn-primary">search ♡</button>
      </form>
      ${results}
    </section>`,
  });
}

export function renderForbidden(): string {
  return layout({
    title: "Forbidden",
    user: null,
    csrfToken: "",
    body: `<section class="empty-state"><h1>403 Forbidden</h1><p>You do not have permission to do that.</p><a href="/">Back home</a></section>`,
  });
}

export function renderNotFound(): string {
  return layout({
    title: "Not Found",
    user: null,
    csrfToken: "",
    body: `<section class="empty-state"><h1>404 Not Found</h1><p>That page does not exist.</p><a href="/">Back home</a></section>`,
  });
}

export function renderPostListPartial(posts: Post[]): string {
  if (posts.length === 0) {
    return `<div class="empty-state"><p>No posts yet.</p></div>`;
  }
  return `<div class="post-list">${posts.map(renderPostCard).join("")}</div>`;
}
