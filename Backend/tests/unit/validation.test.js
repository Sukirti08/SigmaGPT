import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidThreadId, validateChatBody } from "../../utils/validation.js";

test("accepts UUID-style thread ids", () => {
    assert.ok(isValidThreadId("3f1c2a90-9b1e-11ef-8c3a-0242ac120002"));
});

test("rejects thread ids with spaces, symbols, or excessive length", () => {
    for (const bad of ["", "a b", "<script>", "../x", "x".repeat(101), 42, null]) assert.equal(isValidThreadId(bad), false);
});

test("requires both fields and trims whitespace", () => {
    assert.equal(validateChatBody({}, 8000).status, 400);
    assert.equal(validateChatBody({ threadId: "t1", message: "   " }, 8000).status, 400);
    assert.deepEqual(validateChatBody({ threadId: " t1 ", message: " hi " }, 8000), { ok: true, threadId: "t1", message: "hi" });
});

test("rejects non-string fields", () => {
    assert.equal(validateChatBody({ threadId: 1, message: ["x"] }, 8000).ok, false);
});

test("enforces the message length boundary (8000 accepted, 8001 rejected with 413)", () => {
    assert.equal(validateChatBody({ threadId: "t", message: "a".repeat(8000) }, 8000).ok, true);
    assert.equal(validateChatBody({ threadId: "t", message: "a".repeat(8001) }, 8000).status, 413);
});
