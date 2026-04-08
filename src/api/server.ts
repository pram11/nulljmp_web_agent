import Fastify, { FastifyError } from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "../config";
import { jobRoutes } from "./routes/jobs";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(helmet);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });

  await app.register(jobRoutes, { prefix: "/jobs" });

  app.setErrorHandler((error: FastifyError, _req, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: error.message,
      statusCode,
    });
  });

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.api.port, host: "0.0.0.0" });
}
