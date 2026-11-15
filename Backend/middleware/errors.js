import mongoose from "mongoose";

/** Reject API requests quickly when the database is unavailable instead of waiting on buffered queries. */
export const requireDatabase = (req, res, next) => {
    if (mongoose.connection.readyState === 1) return next();
    return res.status(503).json({ error: "The database is unavailable. Please try again shortly.", code: "DB_UNAVAILABLE" });
};

export const notFound = (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found.`, code: "NOT_FOUND" });
};

/** Final error handler: always responds with JSON and never leaks stack traces. */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
    if (err?.type === "entity.parse.failed") {
        return res.status(400).json({ error: "The request body is not valid JSON.", code: "BAD_JSON" });
    }
    if (err?.type === "entity.too.large") {
        return res.status(413).json({ error: "The request body is too large.", code: "BODY_TOO_LARGE" });
    }
    if (Number.isInteger(err?.status) && err.expose) {
        if (err.retryAfter) res.setHeader("Retry-After", String(err.retryAfter));
        return res.status(err.status).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
    }
    if (err instanceof mongoose.Error || err?.name?.startsWith("Mongo")) {
        console.error("Database error:", err.message);
        return res.status(503).json({ error: "A database error occurred. Please try again shortly.", code: "DB_ERROR" });
    }
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error.", code: "INTERNAL" });
};

export const securityHeaders = (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
};
