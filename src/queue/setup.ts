/**
 * Declares all queues and the DLQ exchange so they exist before any
 * producer or consumer tries to use them.  Safe to call multiple times.
 */
import { Channel } from "amqplib";
import { config } from "../config";

const { taskQueue, dlq, exchange } = config.rabbitmq;

export async function setupQueues(channel: Channel): Promise<void> {
  // Dead-letter exchange (direct)
  await channel.assertExchange(exchange, "direct", { durable: true });

  // Dead-letter queue – messages land here after all retries are exhausted
  await channel.assertQueue(dlq, { durable: true });
  await channel.bindQueue(dlq, exchange, dlq);

  // Main task queue – uses the DLX so nack'd messages route to DLQ
  await channel.assertQueue(taskQueue, {
    durable: true,
    arguments: {
      "x-dead-letter-exchange": exchange,
      "x-dead-letter-routing-key": dlq,
    },
  });

  console.log(`[Queue] Declared: ${taskQueue} → DLX → ${dlq}`);
}
