// Black-box API tests. Run against a running backend:
//   BASE_URL=http://localhost:8080 node --test evaluation/blackbox.test.mjs
// Requires the mock OpenAI server (evaluation/mock-openai.mjs) configured via OPENAI_BASE_URL on the backend.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
const authorization = `Bearer ${randomBytes(32).toString("hex")}`;

const BASE = process.env.BASE_URL || "http://localhost:8080";
const T = { timeout: 15000 };

async function call(method, path, body, headers = {}, raw = false) {
  const opts = { method, headers: { ...(path.startsWith("/api/") && { Authorization: authorization }), ...headers } };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = raw ? body : JSON.stringify(body);
  }
  const t0 = performance.now();
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, text, json, ms: performance.now() - t0 };
}
const chat = (threadId, message) => call("POST", "/api/chat", { threadId, message });
const isJson = (r) => (r.headers.get("content-type") || "").includes("application/json") && r.json !== null;

test("B01 health endpoint reports database connected", T, async () => {
  const r = await call("GET", "/health");
  assert.equal(r.status, 200);
  assert.equal(r.json.database, "connected");
});

test("B02 valid chat request returns a reply and persists both messages", T, async () => {
  const id = randomUUID();
  const r = await chat(id, "Explain recursion with a simple example");
  assert.equal(r.status, 200);
  assert.match(r.json.reply, /MOCK_REPLY/);
  const t = await call("GET", `/api/thread/${id}`);
  assert.equal(t.status, 200);
  assert.equal(t.json.length, 2);
  assert.deepEqual(t.json.map(m => m.role), ["user", "assistant"]);
});

test("B03 follow-up question is sent with conversation history", T, async () => {
  const id = randomUUID();
  await chat(id, "First question about recursion");
  const r = await chat(id, "Give another example");
  assert.equal(r.status, 200);
  // system + user + assistant + user = 4 messages, and the first user message is included
  assert.match(r.json.reply, /messages=4 system=true first_user="First question about recursion"/);
});

test("B04 new conversation appears in the thread list with a title", T, async () => {
  const id = randomUUID();
  await chat(id, "Title check message");
  const r = await call("GET", "/api/thread");
  assert.equal(r.status, 200);
  const t = r.json.find(x => x.threadId === id);
  assert.ok(t, "thread listed");
  assert.equal(t.title, "Title check message");
});

test("B05 empty body is rejected with 400 JSON", T, async () => {
  const r = await call("POST", "/api/chat", {});
  assert.equal(r.status, 400);
  assert.ok(isJson(r));
});

test("B06 malformed JSON is rejected with 400 JSON", T, async () => {
  const r = await call("POST", "/api/chat", "{bad json", {}, true);
  assert.equal(r.status, 400);
  assert.ok(isJson(r), "error body should be JSON, got: " + r.text.slice(0, 60));
});

test("B07 message over 8,000 characters is rejected with 413 JSON", T, async () => {
  const r = await chat(randomUUID(), "a".repeat(8001));
  assert.equal(r.status, 413);
  assert.ok(isJson(r));
});

test("B08 request body over the size limit is rejected with 413 JSON", T, async () => {
  const r = await call("POST", "/api/chat", { threadId: randomUUID(), message: "a".repeat(1_100_000) });
  assert.equal(r.status, 413);
  assert.ok(isJson(r), "error body should be JSON, got: " + r.text.slice(0, 60));
});

test("B09 unknown conversation returns 404 JSON", T, async () => {
  const r = await call("GET", `/api/thread/${randomUUID()}`);
  assert.equal(r.status, 404);
  assert.ok(isJson(r));
});

test("B10 malformed conversation id is rejected with 400", T, async () => {
  const r = await call("GET", `/api/thread/${encodeURIComponent("bad id<script>")}`);
  assert.equal(r.status, 400);
});

test("B11 deleting an unknown conversation returns 404", T, async () => {
  const r = await call("DELETE", `/api/thread/${randomUUID()}`);
  assert.equal(r.status, 404);
});

test("B12 deleting an existing conversation removes it", T, async () => {
  const id = randomUUID();
  await chat(id, "to be deleted");
  const d = await call("DELETE", `/api/thread/${id}`);
  assert.equal(d.status, 200);
  const g = await call("GET", `/api/thread/${id}`);
  assert.equal(g.status, 404);
});

test("B13 provider 500 error returns 502 JSON and saves nothing", T, async () => {
  const id = randomUUID();
  const r = await chat(id, "__ERROR500__");
  assert.equal(r.status, 502);
  assert.ok(isJson(r));
  const g = await call("GET", `/api/thread/${id}`);
  assert.equal(g.status, 404);
});

test("B14 empty provider reply returns 502", T, async () => {
  const r = await chat(randomUUID(), "__EMPTY__");
  assert.equal(r.status, 502);
});

test("B15 provider timeout returns 504 promptly", { timeout: 9000 }, async () => {
  const r = await chat(randomUUID(), "__DELAY__");
  assert.equal(r.status, 504);
  assert.ok(r.ms < 8000, `took ${Math.round(r.ms)} ms`);
});

test("B16 provider rate limit returns 429 JSON", { timeout: 30000 }, async () => {
  const r = await chat(randomUUID(), "__RATE429__");
  assert.equal(r.status, 429);
  assert.ok(isJson(r));
});

test("B17 unknown API route returns 404 JSON", T, async () => {
  const r = await call("GET", "/api/does-not-exist");
  assert.equal(r.status, 404);
  assert.ok(isJson(r), "got: " + r.text.slice(0, 60));
});

test("B18 context respects a character budget for long messages", { timeout: 30000 }, async () => {
  const id = randomUUID();
  let r;
  for (let i = 0; i < 4; i++) r = await chat(id, `${i} ` + "x".repeat(7000));
  // Stored: 4 user (7 KB each) + 3 short replies = 7 messages. A 24,000-character budget must drop the oldest.
  const n = Number(/messages=(\d+)/.exec(r.json.reply)[1]);
  assert.ok(n < 8, `messages sent = ${n}`);
});

test("B19 X-Powered-By header is not exposed and nosniff is set", T, async () => {
  const r = await call("GET", "/health");
  assert.equal(r.headers.get("x-powered-by"), null);
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
});

test("B20 CORS allows only the configured origin", T, async () => {
  const ok = await call("GET", "/api/thread", undefined, { Origin: "http://localhost:5173" });
  const bad = await call("GET", "/api/thread", undefined, { Origin: "http://evil.example" });
  assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
  assert.equal(bad.headers.get("access-control-allow-origin"), null);
});

test("B21 chat endpoint is rate limited", { timeout: 30000 }, async () => {
  let limited = null;
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await call("POST", "/api/chat", {});
    if (r.status === 429) limited = r;
  }
  assert.ok(limited, "no 429 after 40 rapid requests");
  assert.ok(limited.headers.get("retry-after"), "Retry-After header present");
});
