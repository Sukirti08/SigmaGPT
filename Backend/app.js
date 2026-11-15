import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { createChatRouter } from "./routes/chat.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFound, requireDatabase, securityHeaders } from "./middleware/errors.js";

// Host name of the AI provider (for example api.groq.com); never includes credentials.
const providerHost = (url) => { try { return new URL(url).host; } catch { return "unknown"; } };

const DB_STATES = ["disconnected", "connected", "connecting", "disconnecting"];

/** Build the Express application. Kept separate from server start-up so it can be tested. */
export const createApp = (config, { generateReply } = {}) => {
    const app = express();
    app.disable("x-powered-by");
    app.use(securityHeaders);
    app.use(cors({ origin: config.allowedOrigins }));
    app.use(express.json({ limit: config.limits.bodyLimit }));

    app.get("/health", (_req, res) => {
        const database = DB_STATES[mongoose.connection.readyState] ?? "unknown";
        const ok = database === "connected";
        res.status(ok ? 200 : 503).json({
            status: ok ? "ok" : "degraded",
            database,
            ai: config.openai.apiKey ? "configured" : "missing API key",
            model: config.openai.model,
            provider: providerHost(config.openai.baseURL),
            uptimeSeconds: Math.round(process.uptime()),
        });
    });

    const chatLimiter = createRateLimiter(config.rateLimit);
    app.use("/api", requireDatabase, createChatRouter({ config, chatLimiter, generateReply }));

    app.use(notFound);
    app.use(errorHandler);
    return app;
};
