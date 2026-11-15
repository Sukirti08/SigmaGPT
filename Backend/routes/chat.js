import express from "express";
import mongoose from "mongoose";
import Thread from "../models/Thread.js";
import getOpenAIAPIResponse from "../utils/openai.js";
import { HttpError } from "../utils/httpError.js";
import { isValidThreadId, validateChatBody } from "../utils/validation.js";
import { requireChatSession } from "../middleware/chatSession.js";

const filterForThread = (req, threadId = req.params.threadId) => ({ threadId, ownerHash: req.ownerHash });
const chatConflict = () => new HttpError(409, "This conversation is busy or has changed. Try again shortly.", {
    code: "CHAT_CONFLICT"
});

async function saveThread(thread) {
    try {
        await thread.save();
    } catch (error) {
        if (error?.code === 11000 || error instanceof mongoose.Error.VersionError ||
            error instanceof mongoose.Error.DocumentNotFoundError) throw chatConflict();
        throw error;
    }
}

/**
 * Chat and conversation routes.
 * @param {{config: object, chatLimiter: Function, generateReply?: Function}} deps
 *        generateReply can be injected in tests; defaults to the OpenAI integration.
 */
export const createChatRouter = ({ config, chatLimiter, generateReply = getOpenAIAPIResponse }) => {
    const router = express.Router();
    const pendingChats = new Set();
    router.use(["/thread", "/chat"], requireChatSession);

    const pendingKey = (req, threadId = req.params.threadId) => `${req.ownerHash}:${threadId}`;

    // Validate :threadId wherever it appears.
    router.param("threadId", (req, res, next, threadId) => {
        if (!isValidThreadId(threadId)) return next(new HttpError(400, "Invalid conversation id.", { code: "BAD_THREAD_ID" }));
        return next();
    });

    // List conversations, newest first (metadata only).
    router.get("/thread", async (req, res) => {
        const threads = await Thread.find({ ownerHash: req.ownerHash }, "threadId title createdAt updatedAt")
            .sort({ updatedAt: -1 })
            .lean();
        res.json(threads);
    });

    // Get messages for one conversation.
    router.get("/thread/:threadId", async (req, res) => {
        const thread = await Thread.findOne(filterForThread(req)).lean();
        if (!thread) throw new HttpError(404, "Conversation not found.", { code: "THREAD_NOT_FOUND" });
        res.json(thread.messages);
    });

    // Delete one conversation.
    router.delete("/thread/:threadId", async (req, res) => {
        if (pendingChats.has(pendingKey(req))) throw chatConflict();
        const deleted = await Thread.findOneAndDelete(filterForThread(req));
        if (!deleted) throw new HttpError(404, "Conversation not found.", { code: "THREAD_NOT_FOUND" });
        res.json({ success: true, message: "Conversation deleted." });
    });

    // Send a message and generate a context-aware reply.
    router.post("/chat", chatLimiter, async (req, res) => {
        const input = validateChatBody(req.body, config.limits.maxMessageChars);
        if (!input.ok) throw new HttpError(input.status, input.error, { code: "VALIDATION" });
        const { threadId, message } = input;

        const key = pendingKey(req, threadId);
        if (pendingChats.has(key)) throw chatConflict();
        pendingChats.add(key);

        try {
            const thread = await Thread.findOne(filterForThread(req, threadId))
                ?? new Thread({ threadId, ownerHash: req.ownerHash, title: message.slice(0, 80), messages: [] });
            const history = [
                ...thread.messages.map(({ role, content }) => ({ role, content })),
                { role: "user", content: message },
            ];

            // A provider failure leaves the conversation unchanged.
            const reply = await generateReply(history, config);
            thread.messages.push({ role: "user", content: message });
            thread.messages.push({ role: "assistant", content: reply });
            thread.updatedAt = new Date();
            await saveThread(thread);

            const saved = thread.messages;
            res.json({
                reply,
                threadId,
                userMessageId: saved[saved.length - 2]._id,
                messageId: saved[saved.length - 1]._id,
            });
        } finally {
            pendingChats.delete(key);
        }
    });

    // Record or clear the user's feedback ("up", "down" or null) on one assistant reply.
    router.patch("/thread/:threadId/messages/:messageId/feedback", async (req, res) => {
        const { messageId } = req.params;
        if (!mongoose.isValidObjectId(messageId)) throw new HttpError(400, "Invalid message id.", { code: "BAD_MESSAGE_ID" });
        const value = req.body?.value ?? null;
        if (value !== null && value !== "up" && value !== "down") {
            throw new HttpError(400, "Feedback must be \"up\", \"down\" or null.", { code: "VALIDATION" });
        }
        const thread = await Thread.findOne(filterForThread(req));
        if (!thread) throw new HttpError(404, "Conversation not found.", { code: "THREAD_NOT_FOUND" });
        const msg = thread.messages.id(messageId);
        if (!msg) throw new HttpError(404, "Message not found.", { code: "MESSAGE_NOT_FOUND" });
        if (msg.role !== "assistant") throw new HttpError(400, "Feedback can be given only on assistant replies.", { code: "VALIDATION" });
        msg.feedback = value ?? undefined;
        await saveThread(thread);
        res.json({ success: true, messageId, feedback: value });
    });

    return router;
};
