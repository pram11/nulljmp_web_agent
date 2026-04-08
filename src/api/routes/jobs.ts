import type { FastifyInstance, FastifyRequest } from "fastify";
import { publisher } from "../../queue/publisher";
import type { JobPayload } from "../../types";

// ── JSON Schema ──────────────────────────────────────────────────────────────

const selectorParam = {
  type: "object",
  required: ["selector"],
  properties: { selector: { type: "string", minLength: 1 } },
  additionalProperties: false,
} as const;

const actionSchema = {
  type: "object",
  required: ["type"],
  properties: {
    id:   { type: "string" },
    type: {
      type: "string",
      enum: [
        "goto", "reload", "back",
        "click", "fill", "hover", "press", "check",
        "wait_for_selector", "sleep",
        "extract", "screenshot", "pdf",
        "exists",
      ],
    },
    params: { type: "object" },
    on_true:  { type: "array" },
    on_false: { type: "array" },
  },
  additionalProperties: false,
} as const;

const postJobSchema = {
  body: {
    type: "object",
    required: ["job_id", "actions"],
    additionalProperties: false,
    properties: {
      job_id: { type: "string", minLength: 1 },
      options: {
        type: "object",
        additionalProperties: false,
        properties: {
          timeout:  { type: "number", minimum: 1000, maximum: 120000 },
          viewport: {
            type: "object",
            required: ["width", "height"],
            additionalProperties: false,
            properties: {
              width:  { type: "number", minimum: 320, maximum: 3840 },
              height: { type: "number", minimum: 240, maximum: 2160 },
            },
          },
        },
      },
      actions: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: actionSchema,
      },
    },
  },
  response: {
    202: {
      type: "object",
      properties: {
        job_id:  { type: "string" },
        status:  { type: "string" },
        message: { type: "string" },
      },
    },
  },
} as const;

// ── Route ────────────────────────────────────────────────────────────────────

export async function jobRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { schema: postJobSchema },
    async (req: FastifyRequest<{ Body: JobPayload }>, reply) => {
      const payload = req.body;

      await publisher.publish(payload);

      return reply.status(202).send({
        job_id:  payload.job_id,
        status:  "queued",
        message: `Job ${payload.job_id} accepted. Consume results from the task_results queue.`,
      });
    }
  );
}
