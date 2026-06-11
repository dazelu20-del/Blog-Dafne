import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";
import { resetDb } from "./helpers";

async function request(
  path: string,
  init: RequestInit = {},
  cookies = ""
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (cookies) headers.set("Cookie", cookies);
  const req = new Request(`http://localhost${path}`, { ...init, headers });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

async function signupAndLogin(
  username: string,
  email: string,
  password = "password123"
): Promise<string> {
  await request("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, email, password }).toString(),
  });
  const loginRes = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
  });
  const setCookie = loginRes.headers.get("Set-Cookie") || "";
  const match = setCookie.match(/session=([^;]+)/);
  return match ? `session=${match[1]}` : "";
}

describe("blog app", () => {
  beforeEach(async () => {
    await resetDb(env.DB);
  });

  it("GET / returns 200", async () => {
    const res = await request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Latest Posts");
  });

  it("signup, login, logout flow", async () => {
    const signup = await request("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "alice",
        email: "alice@example.com",
        password: "password123",
      }).toString(),
    });
    expect(signup.status).toBe(302);
    expect(signup.headers.get("Location")).toBe("/login");

    const login = await request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "alice",
        password: "password123",
      }).toString(),
    });
    expect(login.status).toBe(302);
    const cookie = login.headers.get("Set-Cookie") || "";

    const logout = await request(
      "/logout",
      { method: "POST" },
      cookie.match(/session=[^;]+/)?.[0] || ""
    );
    expect(logout.status).toBe(302);
  });

  it("rejects duplicate username case-insensitively", async () => {
    await request("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "Alice",
        email: "a1@example.com",
        password: "password123",
      }).toString(),
    });
    const dup = await request("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "alice",
        email: "a2@example.com",
        password: "password123",
      }).toString(),
    });
    expect(dup.status).toBe(400);
  });

  it("creates, edits, deletes posts", async () => {
    const cookie = await signupAndLogin("bob", "bob@example.com");
    const create = await request(
      "/new",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          title: "Hello",
          body: "World content here",
        }).toString(),
      },
      cookie
    );
    expect(create.status).toBe(302);
    const location = create.headers.get("Location") || "";
    const id = location.split("/").pop();

    const detail = await request(`/post/${id}`, {}, cookie);
    expect(detail.status).toBe(200);

    const edit = await request(
      `/edit/${id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          title: "Hello edited",
          body: "Updated body",
        }).toString(),
      },
      cookie
    );
    expect(edit.status).toBe(302);

    const deleteRes = await request(
      `/delete/${id}`,
      { method: "POST" },
      cookie
    );
    expect(deleteRes.status).toBe(302);
  });

  it("returns 403 when non-author edits", async () => {
    const authorCookie = await signupAndLogin("author", "author@example.com");
    const create = await request(
      "/new",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ title: "Secret", body: "Body text" }).toString(),
      },
      authorCookie
    );
    const id = (create.headers.get("Location") || "").split("/").pop();
    const otherCookie = await signupAndLogin("other", "other@example.com");
    const edit = await request(`/edit/${id}`, { method: "GET" }, otherCookie);
    expect(edit.status).toBe(403);
  });

  it("comments and reactions via API", async () => {
    const cookie = await signupAndLogin("carol", "carol@example.com");
    const create = await request(
      "/new",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ title: "API", body: "Testing APIs" }).toString(),
      },
      cookie
    );
    const id = (create.headers.get("Location") || "").split("/").pop();

    const comment = await request(
      `/api/post/${id}/comment`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: "Nice post!" }),
      },
      cookie
    );
    expect(comment.status).toBe(201);
    const commentJson = (await comment.json()) as { ok: boolean };
    expect(commentJson.ok).toBe(true);

    const react = await request(
      `/api/post/${id}/react`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "like" }),
      },
      cookie
    );
    expect(react.status).toBe(200);
    const reactJson = (await react.json()) as {
      ok: boolean;
      reaction: string | null;
    };
    expect(reactJson.reaction).toBe("like");

    const toggle = await request(
      `/api/post/${id}/react`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "like" }),
      },
      cookie
    );
    const toggleJson = (await toggle.json()) as {
      reaction: string | null;
    };
    expect(toggleJson.reaction).toBeNull();
  });

  it("search handles empty query and wildcards", async () => {
    const empty = await request("/search");
    expect(empty.status).toBe(200);
    expect(await empty.text()).toContain("Enter a search term");

    const cookie = await signupAndLogin("dave", "dave@example.com");
    await request(
      "/new",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          title: "100% complete",
          body: "literal percent sign",
        }).toString(),
      },
      cookie
    );
    const search = await request("/search?q=" + encodeURIComponent("100%"));
    expect(search.status).toBe(200);
    expect(await search.text()).toContain("100% complete");
  });

  it("redirects unsafe next URLs to /", async () => {
    await request("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "eve",
        email: "eve@example.com",
        password: "password123",
      }).toString(),
    });
    const login = await request("/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "eve",
        password: "password123",
        next: "//evil.com",
      }).toString(),
    });
    expect(login.headers.get("Location")).toBe("/");
  });

  it("sets security headers", async () => {
    const res = await request("/");
    expect(res.headers.get("Content-Security-Policy")).toBe("default-src 'self'");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });
});
