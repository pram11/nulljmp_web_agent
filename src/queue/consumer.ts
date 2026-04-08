import { Channel, ConsumeMessage } from "amqplib";
import { config } from "../config";
import { rabbitMQ } from "./connection";
import { setupQueues } from "./setup";
import type { JobPayload } from "../types";

export type JobHandler = (payload: JobPayload) => Promise<void>;
/** Called once when a job exhausts all retries, just before nack → DLQ. */
export type ExhaustedHandler = (payload: JobPayload, error: string) => Promise<void>;

export class Consumer {
  private channel: Channel | null = null;

  async start(handler: JobHandler, onExhausted?: ExhaustedHandler): Promise<void> {
    this.channel = await rabbitMQ.createChannel();
    await setupQueues(this.channel);

    await this.channel.prefetch(config.rabbitmq.prefetch);

    await this.channel.consume(
      config.rabbitmq.taskQueue,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return; // consumer cancelled

        const payload = this.parseMessage(msg);
        if (!payload) {
          // Unparseable — send straight to DLQ, don't retry
          this.channel!.nack(msg, false, false);
          return;
        }

        const retries = payload._retries ?? 0;

        try {
          await handler(payload);
          this.channel!.ack(msg);
        } catch (err) {
          const message = (err as Error).message;
          console.error(`[Consumer] Job ${payload.job_id} failed: ${message}`);

          if (retries < config.worker.maxRetries) {
            console.warn(
              `[Consumer] Retrying job ${payload.job_id} (attempt ${retries + 1}/${config.worker.maxRetries})`
            );
            await this.delay(config.worker.retryDelayMs * (retries + 1));
            // Re-queue with incremented retry counter
            await this.requeue({ ...payload, _retries: retries + 1 });
            this.channel!.ack(msg);
          } else {
            console.error(
              `[Consumer] Job ${payload.job_id} exhausted retries — sending to DLQ`
            );
            if (onExhausted) {
              try {
                await onExhausted(payload, message);
              } catch (publishErr) {
                console.error(
                  `[Consumer] Failed to publish exhausted result for ${payload.job_id}:`,
                  (publishErr as Error).message
                );
              }
            }
            this.channel!.nack(msg, false, false); // route to DLQ via DLX
          }
        }
      },
      { noAck: false }
    );

    console.log(
      `[Consumer] Listening on "${config.rabbitmq.taskQueue}" (prefetch=${config.rabbitmq.prefetch})`
    );
  }

  async stop(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = null;
    }
  }

  private parseMessage(msg: ConsumeMessage): JobPayload | null {
    try {
      return JSON.parse(msg.content.toString()) as JobPayload;
    } catch {
      console.error("[Consumer] Failed to parse message:", msg.content.toString());
      return null;
    }
  }

  private async requeue(payload: JobPayload): Promise<void> {
    if (!this.channel) return;
    const body = Buffer.from(JSON.stringify(payload));
    this.channel.sendToQueue(config.rabbitmq.taskQueue, body, {
      persistent: true,
      contentType: "application/json",
      messageId: payload.job_id,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const consumer = new Consumer();
