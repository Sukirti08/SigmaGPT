// Start-up, configuration and database-failure scenarios.
// Usage: node evaluation/scenarios.mjs <Backend dir> <label>
// Needs: mongod binary path in MONGOD (for the "database stops" scenario) and the mock OpenAI on :9100.
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
const authorization = `Bearer ${randomBytes(32).toString("hex")}`;

const [dir, label] = process.argv.slice(2);
const MONGOD = process.env.MONGOD;
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const startServer = (env) => {
  const p = spawn("node", ["server.js"], { cwd: dir, env: { PATH: process.env.PATH, HOME: process.env.HOME, OPENAI_BASE_URL: "http://127.0.0.1:9100/v1", ...env } });
  p.out = "";
  p.stdout.on("data", (d) => { p.out += d; });
  p.stderr.on("data", (d) => { p.out += d; });
  p.exited = new Promise((r) => p.on("exit", (code) => r(code)));
  return p;
};
const waitHealthy = async (port, ms = 8000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { try { await fetch(`http://localhost:${port}/health`); return true; } catch { await sleep(150); } }
  return false;
};
const req = async (port, method, path, body) => {
  const t0 = performance.now();
  try {
    const r = await fetch(`http://localhost:${port}${path}`, { method, headers: { Authorization: authorization, "Content-Type": "application/json" }, body: body && JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    return { status: r.status, text: (await r.text()).slice(0, 140), ms: Math.round(performance.now() - t0) };
  } catch (e) { return { status: "no response", text: e.message, ms: Math.round(performance.now() - t0) }; }
};
const record = (id, name, observed, pass) => results.push({ id, name, observed, pass });

// S1 missing MONGODB_URI
{
  const p = startServer({ PORT: "8090", OPENAI_API_KEY: "test-key" });
  const t0 = Date.now();
  const code = await Promise.race([p.exited, sleep(15000).then(() => "still running")]);
  if (code === "still running") p.kill();
  record("S1", "Start without MONGODB_URI", `exit=${code} after ${Date.now() - t0} ms; "${p.out.trim().split("\n")[0]}"`, code === 1);
}
// S2 unreachable MongoDB
{
  const p = startServer({ PORT: "8091", OPENAI_API_KEY: "test-key", MONGODB_URI: "mongodb://127.0.0.1:1/x" });
  const t0 = Date.now();
  const code = await Promise.race([p.exited, sleep(40000).then(() => "still running")]);
  if (code === "still running") p.kill();
  const ms = Date.now() - t0;
  record("S2", "Start with unreachable MongoDB", `exit=${code} after ${ms} ms`, code === 1 && ms < 10000);
}
// S3 missing API key / S4 invalid API key
for (const [id, key, name] of [["S3", "", "Chat with missing OPENAI_API_KEY"], ["S4", "bad-key", "Chat with invalid OPENAI_API_KEY"]]) {
  const p = startServer({ PORT: "8092", OPENAI_API_KEY: key, OPENAI_MAX_RETRIES: "0", MONGODB_URI: "mongodb://127.0.0.1:27017/sigmagpt_scen" });
  await waitHealthy(8092);
  const r = await req(8092, "POST", "/api/chat", { threadId: randomUUID(), message: "hi" });
  const expected = id === "S3" ? r.status === 503 : (r.status === 502 && /API key/.test(r.text));
  record(id, name, `HTTP ${r.status}: ${r.text}`, expected);
  p.kill(); await p.exited;
}
// S5/S6 database stops while the server is running
if (MONGOD) {
  const dbpath = mkdtempSync(join(tmpdir(), "mdb-"));
  execFileSync(MONGOD, ["--dbpath", dbpath, "--port", "27018", "--bind_ip", "127.0.0.1", "--fork", "--logpath", join(dbpath, "log")]);
  const p = startServer({ PORT: "8093", OPENAI_API_KEY: "test-key", MONGODB_URI: "mongodb://127.0.0.1:27018/x" });
  await waitHealthy(8093);
  execFileSync(MONGOD, ["--dbpath", dbpath, "--shutdown"]);
  await sleep(1500);
  const list = await req(8093, "GET", "/api/thread");
  record("S5", "List conversations after MongoDB stops", `HTTP ${list.status} after ${list.ms} ms: ${list.text}`, list.status === 503 && list.ms < 3000);
  const health = await req(8093, "GET", "/health");
  record("S6", "Health check after MongoDB stops", `HTTP ${health.status}: ${health.text}`, health.status === 503);
  p.kill(); await p.exited;
}
console.log(JSON.stringify({ label, results }, null, 1));
