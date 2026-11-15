import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../../middleware/rateLimit.js";

const fakeRes = () => {
    const res = { headers: {}, statusCode: 200, body: null };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
};

test("allows up to max requests per window, then returns 429 with Retry-After", () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 60000, max: 3, now: () => t });
    let passed = 0;
    let last;
    for (let i = 0; i < 4; i++) { last = fakeRes(); limiter({ ip: "1.1.1.1" }, last, () => passed++); }
    assert.equal(passed, 3);
    assert.equal(last.statusCode, 429);
    assert.equal(last.headers["Retry-After"], "60");
});

test("counts clients separately and resets after the window", () => {
    let t = 0;
    const limiter = createRateLimiter({ windowMs: 1000, max: 1, now: () => t });
    let passed = 0;
    limiter({ ip: "a" }, fakeRes(), () => passed++);
    limiter({ ip: "b" }, fakeRes(), () => passed++);
    limiter({ ip: "a" }, fakeRes(), () => passed++); // blocked
    t = 1000;
    limiter({ ip: "a" }, fakeRes(), () => passed++); // new window
    assert.equal(passed, 3);
});
