// Measures end-to-end latency of POST /api/chat through the backend and MongoDB with the mock model
// (mock generation time ~0 ms), i.e. the overhead added by SigmaGPT itself, not LLM latency.
// Usage: BASE_URL=... node latency.mjs <label>
import { randomBytes, randomUUID } from "node:crypto";
const authorization = `Bearer ${randomBytes(32).toString("hex")}`;
const BASE = process.env.BASE_URL;
const prompts = ["Explain recursion", "What is a REST API?", "Compare SQL and NoSQL databases", "Write a Python function to reverse a string",
  "What is the difference between TCP and UDP?", "Explain Big-O notation", "What is a closure in JavaScript?", "Summarise the CAP theorem",
  "How does HTTPS work?", "What is gradient descent?"];
const TRIALS = 5;
const time = async (threadId, message) => {
  const t0 = performance.now();
  const r = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" }, body: JSON.stringify({ threadId, message }) });
  await r.text();
  if (r.status !== 200) throw new Error(`status ${r.status}`);
  return performance.now() - t0;
};
const stats = (a) => { const s = [...a].sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(1), median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), min: +s[0].toFixed(1), max: +s.at(-1).toFixed(1) }; };
for (let i = 0; i < 5; i++) await time(randomUUID(), "warm-up");
const fresh = [], follow = [];
for (let t = 0; t < TRIALS; t++) {
  const thread = randomUUID();
  for (const p of prompts) { fresh.push(await time(randomUUID(), p)); follow.push(await time(thread, p)); }
}
console.log(JSON.stringify({ label: process.argv[2], new_conversation_ms: stats(fresh), follow_up_ms: stats(follow) }));
