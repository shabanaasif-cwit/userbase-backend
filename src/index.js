import "dotenv/config";
import { createServer } from "node:http";
import { env } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./db/connect.js";
import { createApp } from "./app.js";
import { initSocketServer } from "./realtime/socketHub.js";

let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, closing...`);
  await new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
  await disconnectMongo().catch((err) => console.error("Mongo disconnect:", err));
  process.exit(0);
}

async function main() {
  await connectMongo();
  const app = createApp();
  const httpServer = createServer(app);
  initSocketServer(httpServer);
  server = httpServer.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
