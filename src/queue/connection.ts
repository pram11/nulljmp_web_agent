import amqp, { ChannelModel, Channel, ConfirmChannel } from "amqplib";
import { config } from "../config";

const RECONNECT_DELAY_MS = 5000;

class RabbitMQConnection {
  private model: ChannelModel | null = null;
  private reconnecting = false;

  async connect(): Promise<ChannelModel> {
    if (this.model) return this.model;

    console.log(`[RabbitMQ] Connecting to ${config.rabbitmq.url} …`);
    this.model = await amqp.connect(config.rabbitmq.url);

    this.model.on("error", (err: Error) => {
      console.error("[RabbitMQ] Connection error:", err.message);
      this.model = null;
      this.scheduleReconnect();
    });

    this.model.on("close", () => {
      console.warn("[RabbitMQ] Connection closed");
      this.model = null;
      this.scheduleReconnect();
    });

    console.log("[RabbitMQ] Connected");
    return this.model;
  }

  async createChannel(): Promise<Channel> {
    const model = await this.connect();
    return model.createChannel();
  }

  async createConfirmChannel(): Promise<ConfirmChannel> {
    const model = await this.connect();
    return model.createConfirmChannel();
  }

  async close(): Promise<void> {
    if (this.model) {
      await this.model.close();
      this.model = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    setTimeout(async () => {
      this.reconnecting = false;
      try {
        await this.connect();
      } catch (err) {
        console.error("[RabbitMQ] Reconnect failed:", (err as Error).message);
        this.scheduleReconnect();
      }
    }, RECONNECT_DELAY_MS);
  }
}

// Module-level singleton shared across the process
export const rabbitMQ = new RabbitMQConnection();
