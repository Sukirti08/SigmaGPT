// Small in-memory fixed-window rate limiter (no external dependency).
// Suitable for a single backend process; a shared store would be needed for several processes.

export const createRateLimiter = ({ windowMs, max, now = () => Date.now() }) => {
    const hits = new Map(); // key -> { count, resetAt }

    const middleware = (req, res, next) => {
        const key = req.ip || req.socket?.remoteAddress || "unknown";
        const t = now();
        let entry = hits.get(key);
        if (!entry || t >= entry.resetAt) {
            entry = { count: 0, resetAt: t + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        res.setHeader("RateLimit-Limit", String(max));
        res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
        if (entry.count > max) {
            const retryAfter = Math.ceil((entry.resetAt - t) / 1000);
            res.setHeader("Retry-After", String(retryAfter));
            return res.status(429).json({ error: `Too many requests. Please wait ${retryAfter} seconds and try again.`, code: "RATE_LIMITED" });
        }
        return next();
    };

    // Remove expired entries so the map does not grow without bound.
    const sweep = setInterval(() => {
        const t = now();
        for (const [key, entry] of hits) if (t >= entry.resetAt) hits.delete(key);
    }, windowMs);
    sweep.unref();

    middleware.reset = () => hits.clear();
    return middleware;
};
