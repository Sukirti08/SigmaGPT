// Integration tests: real Express app + real MongoDB + mock OpenAI server.
// Requires TEST_MONGODB_URI (a disposable database; it is emptied by these tests).
import "dotenv/config";
import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { createApp } from "../../app.js";
import { loadConfig } from "../../config.js";
import Thread from "../../models/Thread.js";
import { startMockOpenAI } from "../helpers/mockOpenAI.js";

const TEST_URI = process.env.TEST_MONGODB_URI;
const authorization = `Bearer ${randomBytes(32).toString("hex")}`;
const otherAuthorization = `Bearer ${randomBytes(32).toString("hex")}`;
const skip = TEST_URI ? false : "TEST_MONGODB_URI is not set (see Backend/.env.example)";

describe("SigmaGPT API", { skip }, () => {
    let mock, server, base, config;

    const start = async (overrides = {}) => {
        if (server) await new Promise((r) => server.close(r));
        config = loadConfig();
        config.mongoUri = TEST_URI;
        config.openai = { ...config.openai, apiKey: "test-key", baseURL: mock.url, timeoutMs: 1000, maxRetries: 0, model: "mock-model", ...overrides.openai };
        config.rateLimit = { windowMs: 60000, max: 1000, ...overrides.rateLimit };
        server = createApp(config).listen(0);
        base = `http://127.0.0.1:${server.address().port}`;
    };
    const call = async (method, path, body, { raw = false, headers = {} } = {}) => {
        const init = { method, headers: { ...(path.startsWith("/api/") && { Authorization: authorization }), ...headers } };
        if (body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = raw ? body : JSON.stringify(body); }
        const res = await fetch(base + path, init);
        const text = await res.text();
        let json = null;
        try { json = JSON.parse(text); } catch { /* not JSON */ }
        return { status: res.status, headers: res.headers, json, text };
    };
    const chat = (threadId, message) => call("POST", "/api/chat", { threadId, message });

    before(async () => {
        mongoose.set("bufferCommands", false);
        await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
        mock = await startMockOpenAI({ delayMs: 2500 });
        await start();
    });
    after(async () => {
        await new Promise((r) => server.close(r));
        await mock.close();
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });
    beforeEach(async () => { await Thread.deleteMany({}); });

    test("GET /health reports the database and AI configuration", async () => {
        const r = await call("GET", "/health");
        assert.equal(r.status, 200);
        assert.equal(r.json.database, "connected");
        assert.equal(r.json.ai, "configured");
        assert.equal(r.json.provider, new URL(mock.url).host);
        assert.equal(JSON.stringify(r.json).includes("test-key"), false, "API key must not be exposed");
    });

    test("POST /api/chat returns a reply and stores both messages", async () => {
        const id = randomUUID();
        const r = await chat(id, "Explain recursion");
        assert.equal(r.status, 200);
        assert.match(r.json.reply, /MOCK_REPLY/);
        const doc = await Thread.findOne({ threadId: id }).lean();
        assert.equal(doc.title, "Explain recursion");
        assert.deepEqual(doc.messages.map((m) => m.role), ["user", "assistant"]);
    });

    test("follow-up requests include the earlier conversation and the system prompt", async () => {
        const id = randomUUID();
        await chat(id, "What is recursion?");
        await chat(id, "Give another example");
        const sent = mock.requests.at(-1).messages;
        assert.equal(sent[0].role, "system");
        assert.deepEqual(sent.slice(1).map((m) => m.role), ["user", "assistant", "user"]);
        assert.equal(sent[1].content, "What is recursion?");
        assert.equal(mock.requests.at(-1).model, "mock-model");
    });

    test("GET /api/thread lists conversations newest first without messages", async () => {
        const a = randomUUID(), b = randomUUID();
        await chat(a, "first");
        await chat(b, "second");
        const r = await call("GET", "/api/thread");
        assert.deepEqual(r.json.map((t) => t.threadId), [b, a]);
        assert.equal(r.json[0].messages, undefined);
    });

    test("GET and DELETE /api/thread/:threadId handle existing, unknown and malformed ids", async () => {
        const id = randomUUID();
        await chat(id, "hello");
        assert.equal((await call("GET", `/api/thread/${id}`)).json.length, 2);
        assert.equal((await call("GET", `/api/thread/${randomUUID()}`)).status, 404);
        assert.equal((await call("GET", "/api/thread/bad%20id")).status, 400);
        assert.equal((await call("DELETE", `/api/thread/${id}`)).status, 200);
        assert.equal((await call("DELETE", `/api/thread/${id}`)).status, 404);
    });

    test("malformed, empty, oversized and invalid requests are rejected with JSON errors", async () => {
        const bad = await call("POST", "/api/chat", "{oops", { raw: true });
        assert.equal(bad.status, 400);
        assert.equal(bad.json.code, "BAD_JSON");
        assert.equal((await call("POST", "/api/chat", {})).status, 400);
        assert.equal((await chat("bad id", "hi")).status, 400);
        assert.equal((await chat(randomUUID(), "a".repeat(8001))).status, 413);
        const huge = await call("POST", "/api/chat", { threadId: "x", message: "a".repeat(200000) });
        assert.equal(huge.status, 413);
        assert.equal(huge.json.code, "BODY_TOO_LARGE");
        assert.equal(await Thread.countDocuments(), 0);
    });

    test("chat replies return message ids and feedback is stored, cleared and validated", async () => {
        const id = randomUUID();
        const r = await chat(id, "rate me");
        assert.ok(r.json.messageId && r.json.userMessageId);
        const path = (mid) => `/api/thread/${id}/messages/${mid}/feedback`;
        assert.equal((await call("PATCH", path(r.json.messageId), { value: "up" })).status, 200);
        let msgs = (await call("GET", `/api/thread/${id}`)).json;
        assert.equal(msgs[1].feedback, "up");
        assert.equal((await call("PATCH", path(r.json.messageId), { value: null })).status, 200);
        msgs = (await call("GET", `/api/thread/${id}`)).json;
        assert.equal(msgs[1].feedback, undefined);
        assert.equal((await call("PATCH", path(r.json.messageId), { value: "great" })).status, 400);
        assert.equal((await call("PATCH", path(r.json.userMessageId), { value: "up" })).status, 400);
        assert.equal((await call("PATCH", path("not-an-id"), { value: "up" })).status, 400);
        assert.equal((await call("PATCH", path("0123456789abcdef01234567"), { value: "up" })).status, 404);
    });

    test("only the session that owns a conversation can read, edit or delete it", async () => {
        const id = randomUUID();
        const created = await chat(id, "This chat belongs to the first browser");
        assert.equal(created.status, 200);
        const threadPath = `/api/thread/${id}`;
        const other = { headers: { Authorization: otherAuthorization } };
        const missing = { headers: { Authorization: "" } };

        assert.equal((await call("GET", "/api/thread", undefined, missing)).status, 401);
        assert.equal((await call("GET", threadPath, undefined, missing)).status, 401);
        assert.equal((await call("DELETE", threadPath, undefined, missing)).status, 401);
        assert.equal((await call("POST", "/api/chat", { threadId: id, message: "hi" }, missing)).status, 401);
        assert.deepEqual((await call("GET", "/api/thread", undefined, other)).json, []);
        assert.equal((await call("GET", threadPath, undefined, other)).status, 404);
        assert.equal((await call("DELETE", threadPath, undefined, other)).status, 404);
        assert.equal((await call("PATCH", `${threadPath}/messages/${created.json.messageId}/feedback`, { value: "up" }, other)).status, 404);
        const ownerRead = await call("GET", threadPath);
        assert.equal(ownerRead.status, 200);
        assert.equal(ownerRead.json.length, 2);
        assert.equal(ownerRead.headers.get("cache-control"), "no-store");
    });

    test("simultaneous messages return a conflict and a later retry can succeed", async () => {
        const id = randomUUID();
        await start({ openai: { timeoutMs: 5000 } });
        const first = chat(id, "__DELAY__");
        try {
            const deadline = Date.now() + 1500;
            while (!mock.requests.at(-1)?.messages.at(-1)?.content.includes("__DELAY__") && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            const overlapping = await chat(id, "second message");
            assert.equal(overlapping.status, 409);
            assert.equal(overlapping.json.code, "CHAT_CONFLICT");
            assert.equal((await first).status, 200);
            assert.equal((await chat(id, "second message")).status, 200);
            const thread = (await call("GET", `/api/thread/${id}`)).json;
            assert.deepEqual(thread.filter((message) => message.role === "user").map((message) => message.content),
                ["__DELAY__", "second message"]);
        } finally {
            await first;
            await start();
        }
    });

    test("unknown routes return 404 JSON", async () => {
        const r = await call("GET", "/api/nothing-here");
        assert.equal(r.status, 404);
        assert.equal(r.json.code, "NOT_FOUND");
    });

    test("provider errors map to safe statuses and save nothing", async () => {
        const cases = [["__ERROR500__", 502], ["__EMPTY__", 502], ["__RATE429__", 429]];
        for (const [marker, status] of cases) {
            const id = randomUUID();
            const r = await chat(id, marker);
            assert.equal(r.status, status, marker);
            assert.ok(r.json.error);
            assert.equal(await Thread.countDocuments({ threadId: id }), 0, `${marker} must not be saved`);
        }
        assert.ok((await chat(randomUUID(), "__RATE429__")).headers.get("retry-after"));
    });

    test("a slow provider is cut off with 504 after the configured timeout", async () => {
        const t0 = Date.now();
        const r = await chat(randomUUID(), "__DELAY__");
        assert.equal(r.status, 504);
        assert.ok(Date.now() - t0 < 2400, "should not wait for the slow reply");
    });

    test("an invalid API key gives a clear 502, and a missing key gives 503", async () => {
        await start({ openai: { apiKey: "bad-key" } });
        const r = await chat(randomUUID(), "hi");
        assert.equal(r.status, 502);
        assert.match(r.json.error, /API key/);
        await start({ openai: { apiKey: "" } });
        const m = await chat(randomUUID(), "hi");
        assert.equal(m.status, 503);
        await start();
    });

    test("the chat endpoint is rate limited per client", async () => {
        await start({ rateLimit: { max: 3 } });
        const statuses = [];
        for (let i = 0; i < 5; i++) statuses.push((await call("POST", "/api/chat", {})).status);
        assert.deepEqual(statuses, [400, 400, 400, 429, 429]);
        await start();
    });

    test("security headers and CORS restrictions are applied", async () => {
        const ok = await call("GET", "/health", undefined, { headers: { Origin: "http://localhost:5173" } });
        assert.equal(ok.headers.get("x-powered-by"), null);
        assert.equal(ok.headers.get("x-content-type-options"), "nosniff");
        assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:5173");
        const evil = await call("GET", "/health", undefined, { headers: { Origin: "http://evil.example" } });
        assert.equal(evil.headers.get("access-control-allow-origin"), null);
    });

    test("API returns 503 quickly while the database is disconnected", async () => {
        await mongoose.disconnect();
        const t0 = Date.now();
        const r = await call("GET", "/api/thread");
        const h = await call("GET", "/health");
        assert.equal(r.status, 503);
        assert.equal(r.json.code, "DB_UNAVAILABLE");
        assert.equal(h.status, 503);
        assert.ok(Date.now() - t0 < 1000);
        await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 3000 });
    });
});
