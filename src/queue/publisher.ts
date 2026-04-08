import { config } from "../config";
import { rabbitMQ } from "./connection";
import { setupQueues } from "./setup";
import type { JobPayload } from "../types";

export class Publisher {
  async publish(payload: JobPayload): Promise<void> {
    const channel = await rabbitMQ.createConfirmChannel();
    await setupQueues(channel);

    const body = Buffer.from(JSON.stringify(payload));

    await new Promise<void>((resolve, reject) => {
      channel.sendToQueue(config.rabbitmq.taskQueue, body, {
        persistent: true,
        contentType: "application/json",
        messageId: payload.job_id,
      }, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    await channel.close();
    console.log(`[Publisher] Queued job ${payload.job_id}`);
  }
}

export const publisher = new Publisher();
