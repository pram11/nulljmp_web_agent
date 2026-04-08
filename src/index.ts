import { startServer } from "./api/server";
import { rabbitMQ } from "./queue/connection";

async function main() {
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await startServer();
}

async function shutdown() {
  console.log("\n[API] Shutting down …");
  await rabbitMQ.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("[API] Fatal:", err);
  process.exit(1);
});
