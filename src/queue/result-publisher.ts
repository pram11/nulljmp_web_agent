import { config } from "../config";
import { rabbitMQ } from "./connection";
import { setupQueues } from "./setup";
import type { JobResult } from "../types";

/**
 * Publishes a JobResult to the results queue.
 * Downstream consumers subscribe to RABBITMQ_RESULT_QUEUE to receive outcomes.
 */
export async function publishResult(result: JobResult): Promise<void> {
  const channel = await rabbitMQ.createConfirmChannel();
  await setupQueues(channel);

  const body = Buffer.from(JSON.stringify(result));

  await new Promise<void>((resolve, reject) => {
    channel.sendToQueue(
      config.rabbitmq.resultQueue,
      body,
      {
        persistent: true,
        contentType: "application/json",
        messageId: result.job_id,
        timestamp: Math.floor(Date.now() / 1000),
      },
      (err) => (err ? reject(err) : resolve())
    );
  });

  await channel.close();
  console.log(
    `[ResultPublisher] Published result for job ${result.job_id} (success=${result.success})`
  );
}
