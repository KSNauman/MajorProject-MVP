import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { connectDatabase, getDatabaseState } from "./config/db.js";
import drawingsRouter from "./routes/drawings.js";
import storiesRouter from "./routes/stories.js";
import webhooksRouter from "./routes/webhooks.js";

// Load environment variables
dotenv.config();

const app = WebhooksAwareApp();

function WebhooksAwareApp() {
  const ax = express();
  // Setup CORS
  ax.use(cors());

  // Mount the Webhook endpoint with exact unaltered raw body parser BEFORE general parsers
  ax.use("/api/v1/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

  // Parse JSON and URL-encoded entries for all standard routes
  ax.use(express.json());
  ax.use(express.urlencoded({ extended: true }));
  return ax;
}

const PORT = process.env.PORT || 3001;

// Setup static serving of the public uploads files
const publicDir = path.join(process.cwd(), "public");
fs.mkdirSync(path.join(publicDir, "uploads", "originals"), { recursive: true });
fs.mkdirSync(path.join(publicDir, "uploads", "processed"), { recursive: true });

app.use(express.static(publicDir));
app.use("/public", express.static(publicDir));

// Establish DB connection on startup
connectDatabase();

// Register Router Endpoints
app.use("/api/v1/drawings", drawingsRouter);
app.use("/api/v1/stories", storiesRouter);

// API Health Check returning database connection state
app.get("/api/v1/health", (req, res) => {
  const dbState = getDatabaseState();
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    database: {
      connection: dbState,
      description: "EduVision persistent schema server microservice",
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
});

export default app;

