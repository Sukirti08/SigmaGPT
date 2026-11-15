import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, startupProblems, startupWarnings } from "../../config.js";

const KEYS = ["PORT", "MONGODB_URI", "OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_BASE_URL", "OPENAI_TIMEOUT_MS", "CONTEXT_MAX_MESSAGES", "FRONTEND_ORIGIN", "OPENAI_TEMPERATURE"];
beforeEach(() => { for (const k of KEYS) delete process.env[k]; });

test("applies defaults", () => {
    const c = loadConfig();
    assert.equal(c.port, 8080);
    assert.equal(c.openai.model, "openai/gpt-oss-20b");
    assert.equal(c.openai.baseURL, "https://api.groq.com/openai/v1");
    assert.equal(c.context.maxMessages, 20);
    assert.deepEqual(c.allowedOrigins, ["http://localhost:5173"]);
});

test("rejects invalid numeric settings with a clear message", () => {
    process.env.OPENAI_TIMEOUT_MS = "abc";
    assert.throws(() => loadConfig(), /OPENAI_TIMEOUT_MS must be an integer/);
    delete process.env.OPENAI_TIMEOUT_MS;
    process.env.OPENAI_TEMPERATURE = "5";
    assert.throws(() => loadConfig(), /OPENAI_TEMPERATURE/);
});

test("reports a missing MONGODB_URI as a start-up problem", () => {
    assert.equal(startupProblems(loadConfig()).length, 1);
    process.env.MONGODB_URI = "mongodb://localhost/x";
    assert.equal(startupProblems(loadConfig()).length, 0);
});

test("warns about a missing or placeholder API key", () => {
    assert.match(startupWarnings(loadConfig())[0], /missing/);
    process.env.OPENAI_API_KEY = "your_openai_api_key_here";
    assert.match(startupWarnings(loadConfig())[0], /placeholder/);
});

test("parses a comma-separated list of origins", () => {
    process.env.FRONTEND_ORIGIN = "http://a.test, http://b.test";
    assert.deepEqual(loadConfig().allowedOrigins, ["http://a.test", "http://b.test"]);
});
