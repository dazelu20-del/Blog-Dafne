import { Hono } from "hono";
import type { Env, AppVariables } from "./types";
import {
  authenticateUser,
  clearSessionCookie,
  createSessionCookie,
  createUser,
  getAuthSecret,
  getUserById,
  getUserIdFromSession,
  hashPassword,
} from "./auth";
import {
  CSRF_COOKIE,
  ensureCsrfCookie,
  getCsrfFromRequest,
  getSecret,
  validateCsrfToken,
} from "./csrf";
import { initSchema } from "./db";
import {
  createComment,
  createPost,
  deletePost,
  emailExists,
  getPost,
  getReactionCounts,
  getUserReaction,
  listComments,
  listPosts,
  searchPosts,
  toggleReaction,
  updatePost,
  usernameExists,
} from "./models";
import {
  appendSetCookie,
  htmlResponse,
  jsonResponse,
  parseCookies,
  redirectResponse,
} from "./security";
import {
  renderAuthForm,
  renderForbidden,
  renderHome,
  renderNotFound,
  renderPostForm,
  renderPostPage,
  renderSearch,
} from "./templates";
import {
  validateBody,
  validateComment,
  validateEmail,
  validatePassword,
  validateReactionKind,
  validateTitle,
  validateUsername,
  normalizeSearchQuery,
} from "./validation";
import { isSafeRedirect, isSecureRequest } from "./utils";

type AppEnv = { Bindings: Env; Variables: AppVariables };

const app = new Hono<AppEnv>();

app.use("*", async (c, next) => {
  const secure = isSecureRequest(new URL(c.req.url));
  const secret = getSecret(c.env);
  const cookies = parseCookies(c.req.header("Cookie"));
  const csrfEnabled =
    c.env.DISABLE_CSRF !== "1" && c.get("csrfEnabled") !== false;
  c.set("csrfEnabled", csrfEnabled);

  const userId = await getUserIdFromSession(secret, c.req.header("Cookie"));
  let username: string | null = null;
  if (userId) {
    const user = await getUserById(c.env.DB, userId);
    username = user?.username || null;
    if (!user) {
      c.set("userId", null);
    } else {
      c.set("userId", userId);
    }
  } else {
    c.set("userId", null);
  }
  c.set("username", username);

  const { token, setCookie: csrfSet } = await ensureCsrfCookie(
    secret,
    cookies[CSRF_COOKIE],
    secure
  );
  c.set("csrfToken", token);
  c.set("csrfCookie", csrfSet);
  c.set("secure", secure);

  await next();

  if (csrfSet && c.res) {
    const headers = new Headers(c.res.headers);
    appendSetCookie(headers, csrfSet);
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers,
    });
  }
});

async function requireCsrf(c: {
  env: Env;
  req: { method: string; header: (n: string) => string | undefined; parseBody: () => Promise<Record<string, unknown>> };
  get: (k: keyof AppVariables) => unknown;
}): Promise<Response | null> {
  if (c.req.method === "GET" || c.req.method === "HEAD") return null;
  if (c.get("csrfEnabled") === false) return null;
  const secret = getSecret(c.env);
  const token = await getCsrfFromRequest(c as never);
  const valid = await validateCsrfToken(secret, token);
  if (!valid) {
    const path = new URL((c as { req: { url: string } }).req.url).pathname;
    if (path.startsWith("/api/")) {
      return jsonResponse({ ok: false, error: "Invalid CSRF token." }, 400);
    }
    return htmlResponse("Bad Request: Invalid CSRF token.", { status: 400 });
  }
  return null;
}

function respondHtml(
  c: { get: (k: keyof AppVariables) => unknown; env: Env },
  body: string,
  status = 200
): Response {
  return htmlResponse(body, { status });
}

function requireLogin(c: {
  get: (k: keyof AppVariables) => unknown;
  req: { url: string };
}): Response | null {
  if (c.get("userId")) return null;
  const path = new URL(c.req.url).pathname;
  return redirectResponse(`/login?next=${encodeURIComponent(path)}`);
}

app.get("/", async (c) => {
  const posts = await listPosts(c.env.DB);
  const user =
    c.get("username") && c.get("userId")
      ? { username: c.get("username") as string }
      : null;
  return respondHtml(
    c,
    renderHome(posts, user, c.get("csrfToken") as string)
  );
});

app.get("/signup", (c) => {
  if (c.get("userId")) return redirectResponse("/");
  return respondHtml(
    c,
    renderAuthForm("signup", c.get("csrfToken") as string, null)
  );
});

app.post("/signup", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;

  const body = await c.req.parseBody();
  const username = String(body.username || "");
  const email = String(body.email || "");
  const password = String(body.password || "");
  const errors: string[] = [];

  for (const v of [
    validateUsername(username),
    validateEmail(email),
    validatePassword(password),
  ]) {
    errors.push(...v.errors);
  }

  if (errors.length === 0) {
    if (await usernameExists(c.env.DB, username)) {
      errors.push("That username is already taken.");
    }
    if (await emailExists(c.env.DB, email)) {
      errors.push("That email is already registered.");
    }
  }

  if (errors.length > 0) {
    return respondHtml(
      c,
      renderAuthForm("signup", c.get("csrfToken") as string, null, errors, {
        username,
        email,
      }),
      400
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    await createUser(c.env.DB, username, email, passwordHash);
  } catch {
    return respondHtml(
      c,
      renderAuthForm("signup", c.get("csrfToken") as string, null, [
        "That username is already taken.",
      ], { username, email }),
      400
    );
  }

  return redirectResponse("/login");
});

app.get("/login", (c) => {
  if (c.get("userId")) return redirectResponse("/");
  const next = c.req.query("next");
  return respondHtml(
    c,
    renderAuthForm(
      "login",
      c.get("csrfToken") as string,
      null,
      [],
      {},
      next
    )
  );
});

app.post("/login", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;

  const body = await c.req.parseBody();
  const username = String(body.username || "");
  const password = String(body.password || "");
  const next = String(body.next || "");

  const user = await authenticateUser(c.env.DB, username, password);
  if (!user) {
    return respondHtml(
      c,
      renderAuthForm(
        "login",
        c.get("csrfToken") as string,
        null,
        ["Invalid username or password."],
        { username },
        next
      ),
      400
    );
  }

  const secret = getAuthSecret(c.env);
  const secure = c.get("secure") as boolean;
  const sessionCookie = await createSessionCookie(secret, user.id, secure);
  const headers = new Headers();
  appendSetCookie(headers, sessionCookie);
  appendSetCookie(headers, c.get("csrfCookie") as string | null);
  const dest = isSafeRedirect(next) ? next : "/";
  headers.set("Location", dest);
  return new Response(null, { status: 302, headers });
});

app.post("/logout", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;
  const secure = c.get("secure") as boolean;
  const headers = new Headers();
  appendSetCookie(headers, clearSessionCookie(secure));
  appendSetCookie(headers, c.get("csrfCookie") as string | null);
  headers.set("Location", "/");
  return new Response(null, { status: 302, headers });
});

app.get("/new", (c) => {
  const loginFail = requireLogin(c);
  if (loginFail) return loginFail;
  return respondHtml(
    c,
    renderPostForm("new", c.get("csrfToken") as string, {
      username: c.get("username") as string,
    })
  );
});

app.post("/new", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;
  const loginFail = requireLogin(c);
  if (loginFail) return loginFail;

  const body = await c.req.parseBody();
  const title = String(body.title || "");
  const postBody = String(body.body || "");
  const errors: string[] = [];
  for (const v of [validateTitle(title), validateBody(postBody)]) {
    errors.push(...v.errors);
  }
  if (errors.length > 0) {
    return respondHtml(
      c,
      renderPostForm(
        "new",
        c.get("csrfToken") as string,
        { username: c.get("username") as string },
        undefined,
        errors
      ),
      400
    );
  }

  const id = await createPost(
    c.env.DB,
    c.get("userId") as number,
    title,
    postBody
  );
  return redirectResponse(`/post/${id}`);
});

app.get("/edit/:id", async (c) => {
  const loginFail = requireLogin(c);
  if (loginFail) return loginFail;
  const id = parseInt(c.req.param("id"), 10);
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c, renderNotFound(), 404);
  if (post.author_id !== c.get("userId")) {
    return respondHtml(c, renderForbidden(), 403);
  }
  return respondHtml(
    c,
    renderPostForm("edit", c.get("csrfToken") as string, {
      username: c.get("username") as string,
    }, post)
  );
});

app.post("/edit/:id", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;
  const loginFail = requireLogin(c);
  if (loginFail) return loginFail;

  const id = parseInt(c.req.param("id"), 10);
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c, renderNotFound(), 404);
  if (post.author_id !== c.get("userId")) {
    return respondHtml(c, renderForbidden(), 403);
  }

  const body = await c.req.parseBody();
  const title = String(body.title || "");
  const postBody = String(body.body || "");
  const errors: string[] = [];
  for (const v of [validateTitle(title), validateBody(postBody)]) {
    errors.push(...v.errors);
  }
  if (errors.length > 0) {
    return respondHtml(
      c,
      renderPostForm(
        "edit",
        c.get("csrfToken") as string,
        { username: c.get("username") as string },
        post,
        errors
      ),
      400
    );
  }

  await updatePost(c.env.DB, id, c.get("userId") as number, title, postBody);
  return redirectResponse(`/post/${id}`);
});

app.post("/delete/:id", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;
  const loginFail = requireLogin(c);
  if (loginFail) return loginFail;

  const id = parseInt(c.req.param("id"), 10);
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c, renderNotFound(), 404);
  if (post.author_id !== c.get("userId")) {
    return respondHtml(c, renderForbidden(), 403);
  }

  await deletePost(c.env.DB, id, c.get("userId") as number);
  return redirectResponse("/");
});

app.get("/post/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const post = await getPost(c.env.DB, id);
  if (!post) return respondHtml(c, renderNotFound(), 404);

  const comments = await listComments(c.env.DB, id);
  const counts = await getReactionCounts(c.env.DB, id);
  const userId = c.get("userId") as number | null;
  const userReaction = userId
    ? await getUserReaction(c.env.DB, id, userId)
    : null;
  const user = c.get("username")
    ? { username: c.get("username") as string }
    : null;

  return respondHtml(
    c,
    renderPostPage(
      post,
      comments,
      counts,
      userReaction,
      user,
      c.get("csrfToken") as string,
      post.author_id === userId
    )
  );
});

app.get("/search", async (c) => {
  const query = normalizeSearchQuery(c.req.query("q"));
  const posts = query ? await searchPosts(c.env.DB, query) : [];
  const user = c.get("username")
    ? { username: c.get("username") as string }
    : null;
  return respondHtml(
    c,
    renderSearch(query, posts, user, c.get("csrfToken") as string)
  );
});

app.post("/api/post/:id/comment", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;

  if (!c.get("userId")) {
    return jsonResponse({ ok: false, error: "Please log in first." }, 401);
  }

  const id = parseInt(c.req.param("id"), 10);
  const post = await getPost(c.env.DB, id);
  if (!post) {
    return jsonResponse({ ok: false, error: "Post not found." }, 404);
  }

  let payload: { body?: unknown };
  try {
    payload = await c.req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Comment must be text." }, 400);
  }

  const validation = validateComment(payload.body);
  if (!validation.ok) {
    return jsonResponse({ ok: false, error: validation.errors[0] }, 400);
  }

  const comment = await createComment(
    c.env.DB,
    id,
    c.get("userId") as number,
    payload.body as string
  );

  return jsonResponse(
    {
      ok: true,
      comment: {
        id: comment!.id,
        post_id: comment!.post_id,
        body: comment!.body,
        created_at: comment!.created_at,
        author: comment!.author,
      },
    },
    201
  );
});

app.post("/api/post/:id/react", async (c) => {
  const csrfFail = await requireCsrf(c);
  if (csrfFail) return csrfFail;

  if (!c.get("userId")) {
    return jsonResponse({ ok: false, error: "Please log in first." }, 401);
  }

  const id = parseInt(c.req.param("id"), 10);
  const post = await getPost(c.env.DB, id);
  if (!post) {
    return jsonResponse({ ok: false, error: "Post not found." }, 404);
  }

  let payload: { kind?: unknown };
  try {
    payload = await c.req.json();
  } catch {
    return jsonResponse(
      { ok: false, error: "Reaction must be 'like' or 'dislike'." },
      400
    );
  }

  const validation = validateReactionKind(payload.kind);
  if (!validation.ok) {
    return jsonResponse({ ok: false, error: validation.errors[0] }, 400);
  }

  const reaction = await toggleReaction(
    c.env.DB,
    id,
    c.get("userId") as number,
    payload.kind as "like" | "dislike"
  );
  const counts = await getReactionCounts(c.env.DB, id);

  return jsonResponse({
    ok: true,
    reaction,
    counts,
  });
});

app.all("*", async (c) => {
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    await initSchema(env.DB);
    return app.fetch(request, env, ctx);
  },
};

export { app };
