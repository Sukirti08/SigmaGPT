import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { loadConfig, startupProblems, startupWarnings } from "./config.js";

const fail = (message) => {
    console.error(`[startup] ${message}`);
    process.exit(1);
};

let config;
try {
    config = loadConfig();
} catch (error) {
    fail(error.message);
}

const problems = startupProblems(config);
if (problems.length) fail(problems.join("\n"));
startupWarnings(config).forEach((w) => console.warn(`[startup] Warning: ${w}`));

// Fail fast instead of buffering queries while the database is down.
mongoose.set("bufferCommands", false);
mongoose.connection.on("disconnected", () => console.warn("[db] MongoDB disconnected."));
mongoose.connection.on("reconnected", () => console.log("[db] MongoDB reconnected."));

const start = async () => {
    try {
        await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: config.dbConnectTimeoutMs });
    } catch (error) {
        fail(`Could not connect to MongoDB within ${config.dbConnectTimeoutMs} ms: ${error.message}\n` +
            "Check that MongoDB is running and that MONGODB_URI in Backend/.env is correct.");
    }
    console.log("[db] Connected to MongoDB.");

    const app = createApp(config);
    const server = app.listen(config.port, () => {
        console.log(`SigmaGPT backend running at http://localhost:${config.port} (model: ${config.openai.model})`);
    });
    server.on("error", (error) => {
        if (error.code === "EADDRINUSE") fail(`Port ${config.port} is already in use. Stop the other process or change PORT.`);
        fail(error.message);
    });

    const shutdown = async (signal) => {
        console.log(`[shutdown] ${signal} received, closing.`);
        server.close();
        await mongoose.disconnect();
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
};

start();
