import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../src/index";
import { resetDb } from "./helpers";

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const req = new Request(`http://localhost${path}`, init);
  const ctx = createExecutionContext();
  const res = await worker.fetch(
    req,
    { ...env, DISABLE_CSRF: undefined },
    ctx
  );
  await waitOnExecutionContext(ctx);
  return res;
}

describe("csrf protection", () => {
  beforeEach(async () => {
    await resetDb(env.DB);
  });

  it("rejects POST without CSRF token", async () => {
    const res = await request("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        username: "csrfuser",
        email: "csrf@example.com",
        password: "password123",
      }).toString(),
    });
    expect(res.status).toBe(400);
  });

  it("rejects API POST without CSRF before auth check", async () => {
    const res = await request("/api/post/1/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hello" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
  });
});
