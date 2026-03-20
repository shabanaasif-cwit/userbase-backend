import mongoose from "mongoose";
import { env } from "../config/env.js";

export async function connectMongo() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

/** `1` = connected (see Mongoose connection `readyState`). */
export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
