import "dotenv/config";

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  rabbitmq: {
    url: optional("RABBITMQ_URL", "amqp://guest:guest@localhost:5672"),
    taskQueue: optional("RABBITMQ_TASK_QUEUE", "task_queue"),
    resultQueue: optional("RABBITMQ_RESULT_QUEUE", "task_results"),
    dlq: optional("RABBITMQ_DLQ", "task_queue.dlq"),
    exchange: optional("RABBITMQ_EXCHANGE", "task_exchange"),
    prefetch: parseInt(optional("RABBITMQ_PREFETCH", "2"), 10),
  },
  worker: {
    maxRetries: parseInt(optional("WORKER_MAX_RETRIES", "3"), 10),
    retryDelayMs: parseInt(optional("WORKER_RETRY_DELAY_MS", "1000"), 10),
  },
  api: {
    port: parseInt(optional("API_PORT", "3000"), 10),
  },
} as const;
