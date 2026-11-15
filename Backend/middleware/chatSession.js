import { createHash } from "node:crypto";
import { HttpError } from "../utils/httpError.js";

/** An anonymous browser proves ownership with an unguessable bearer token. */
export const requireChatSession = (req, res, next) => {
    const token = req.get("authorization")?.match(/^Bearer ([0-9a-f]{64})$/i)?.[1];
    if (!token) {
        return next(new HttpError(401, "A chat session is required.", { code: "CHAT_SESSION_REQUIRED" }));
    }

    req.ownerHash = createHash("sha256").update(token.toLowerCase()).digest("hex");
    res.setHeader("Cache-Control", "no-store");
    return next();
};
