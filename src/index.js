import "dotenv/config";
import { env } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./db/connect.js";
import { createApp } from "./app.js";

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
  server = app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
