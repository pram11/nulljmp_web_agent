import { consumer } from "../queue/consumer";
import { rabbitMQ } from "../queue/connection";
import { browserSingleton } from "../browser/singleton";
import { runJob } from "../browser/engine";
import { publishResult } from "../queue/result-publisher";
import type { JobPayload } from "../types";

async function handleJob(payload: JobPayload): Promise<void> {
  console.log(
    `[Worker] Starting job ${payload.job_id} (${payload.actions.length} action(s))`
  );

  const result = await runJob(payload);

  if (result.success) {
    await publishResult(result);
    console.log(
      `[Worker] Job ${result.job_id} completed in ${result.duration_ms}ms`
    );
  } else {
    // Re-throw so the consumer's retry/DLQ logic can handle it.
    // Result is published only on the final exhaustion via onExhausted below.
    throw new Error(result.error ?? `Job ${result.job_id} failed`);
  }
}

async function main(): Promise<void> {
  console.log("[Worker] Starting …");

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await browserSingleton.get();

  await consumer.start(handleJob, async (payload, error) => {
    await publishResult({
      job_id: payload.job_id,
      success: false,
      steps: [],
      error: `Exhausted retries: ${error}`,
      duration_ms: 0,
    });
  });
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
