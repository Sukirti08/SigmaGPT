import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    // User feedback on an assistant reply ("up" or "down"); absent when no feedback was given.
    feedback: {
        type: String,
        enum: ["up", "down"],
        required: false
    }
});

const ThreadSchema = new mongoose.Schema({
    ownerHash: {
        type: String,
        required: true,
        immutable: true,
        select: false
    },
    threadId: {
        type: String,
        required: true,
        unique: true
    },
    title: {
        type: String,
        default: "New Chat"
    },
    messages: [MessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { optimisticConcurrency: true });

ThreadSchema.index({ ownerHash: 1, updatedAt: -1 });

export default mongoose.model("Thread", ThreadSchema);