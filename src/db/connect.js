import mongoose from "mongoose";
import { env } from "../config/env.js";
import { AdminUser } from "../models/AdminUser.js";
import { Notification } from "../models/Notification.js";
import { Reminder } from "../models/Reminder.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";

export async function connectMongo() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.MONGODB_URI);
  // Keep DB indexes aligned with schemas (drops stale/incorrect unique indexes).
  //syncindex of your schema says email should be unique, syncIndexes() makes sure that unique index exists,
  //  and it can also remove old indexes that no longer match the schema.
  await Promise.all([
    User.syncIndexes(),
    AdminUser.syncIndexes(),
    Notification.syncIndexes(),
    Reminder.syncIndexes(),
    RefreshToken.syncIndexes(),
  ]);
}

//async lets the function wait for that operation properly
export async function disconnectMongo() {
  await mongoose.disconnect();
}

/** `1` = connected (see Mongoose connection `readyState`). */
export function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}
