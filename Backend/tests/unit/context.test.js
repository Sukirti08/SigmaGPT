import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPrompt, selectContext, SYSTEM_PROMPT } from "../../utils/context.js";

const conv = (n, size = 10) => Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? "user" : "assistant", content: `${i}`.padEnd(size, "x"),
}));

test("keeps every message when within both limits", () => {
    assert.equal(selectContext(conv(5), { maxMessages: 20, maxChars: 10000 }).length, 5);
});

test("keeps only the most recent messages under the message limit", () => {
    const out = selectContext(conv(25), { maxMessages: 20, maxChars: 1e6 });
    assert.equal(out.length, 19); // 20 would start with an assistant reply, which is dropped
    assert.equal(out[0].role, "user");
    assert.equal(out.at(-1).content, conv(25).at(-1).content);
});

test("drops the oldest messages when the character budget is exceeded", () => {
    const out = selectContext(conv(7, 7000), { maxMessages: 20, maxChars: 24000 });
    assert.ok(out.reduce((s, m) => s + m.content.length, 0) <= 24000);
    assert.equal(out.at(-1).content, conv(7, 7000).at(-1).content);
});

test("always keeps the newest message even if it alone exceeds the budget", () => {
    const out = selectContext([{ role: "user", content: "x".repeat(5000) }], { maxMessages: 20, maxChars: 1000 });
    assert.equal(out.length, 1);
});

test("removes metadata fields such as timestamps", () => {
    const out = selectContext([{ role: "user", content: "hi", timestamp: new Date(), _id: "1" }], { maxMessages: 5, maxChars: 100 });
    assert.deepEqual(out, [{ role: "user", content: "hi" }]);
});

test("buildPrompt puts the system prompt first", () => {
    const p = buildPrompt(conv(3), { maxMessages: 20, maxChars: 1000 });
    assert.deepEqual(p[0], { role: "system", content: SYSTEM_PROMPT });
    assert.equal(p.length, 4);
});
