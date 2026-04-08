import { consumer } from "../queue/consumer";
import { rabbitMQ } from "../queue/connection";
import { browserSingleton } from "../browser/singleton";
import { runJob } from "../browser/engine";
import type { JobPayload } from "../types";

async function handleJob(payload: JobPayload): Promise<void> {
  console.log(
    `[Worker] Starting job ${payload.job_id} (${payload.actions.length} action(s))`
  );

  const result = await runJob(payload);

  if (result.success) {
    console.log(
      `[Worker] Job ${result.job_id} completed in ${result.duration_ms}ms`
    );
  } else {
    // Re-throw so the consumer's retry/DLQ logic can handle it
    throw new Error(result.error ?? `Job ${result.job_id} failed`);
  }
}

async function main(): Promise<void> {
  console.log("[Worker] Starting …");

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Pre-warm the browser so the first job doesn't pay the launch cost
  await browserSingleton.get();

  await consumer.start(handleJob);
}

async function shutdown(): Promise<void> {
  console.log("\n[Worker] Shutting down …");
  await consumer.stop();
  await browserSingleton.close();
  await rabbitMQ.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("[Worker] Fatal:", err);
  process.exit(1);
});
