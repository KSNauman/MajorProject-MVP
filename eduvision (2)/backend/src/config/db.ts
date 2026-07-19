import mongoose from "mongoose";

export async function connectDatabase(): Promise<void> {
  const mongodbUri = process.env.MONGODB_URI;

  if (!mongodbUri) {
    console.warn("⚠️ MONGODB_URI is not defined in your environment variables. Database functionality will be limited.");
    return;
  }

  try {
    console.log("🔌 Attempting to connect to MongoDB...");
    await mongoose.connect(mongodbUri);
    console.log("✅ Successfully connected to MongoDB Atlas!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
}

export function getDatabaseState(): string {
  const states: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  return states[mongoose.connection.readyState] || "unknown";
}
