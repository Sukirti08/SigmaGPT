import { test } from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { toHttpError } from "../../utils/openai.js";
import { HttpError } from "../../utils/httpError.js";

test("maps a timeout to 504", () => {
    assert.equal(toHttpError(new OpenAI.APIConnectionTimeoutError()).status, 504);
});

test("maps a connection failure to 502", () => {
    assert.equal(toHttpError(new OpenAI.APIConnectionError({ message: "x" })).status, 502);
});

test("does not pass a provider 401 through to the client", () => {
    const e = toHttpError({ status: 401 });
    assert.equal(e.status, 502);
    assert.match(e.message, /API key/);
});

test("maps provider 429 to 429 with Retry-After and other statuses to 502", () => {
    const e = toHttpError({ status: 429 });
    assert.equal(e.status, 429);
    assert.ok(e.retryAfter > 0);
    assert.equal(toHttpError({ status: 500 }).status, 502);
    assert.equal(toHttpError(new Error("unknown")).status, 502);
});

test("leaves application errors unchanged", () => {
    const original = new HttpError(503, "missing key");
    assert.equal(toHttpError(original), original);
});
