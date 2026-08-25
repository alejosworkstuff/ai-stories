import { z } from "zod";

export const streamPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), text: z.string().min(1) }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), code: z.string().min(1) }),
]);

export const generatedStorySchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value), {
    message: "Story contains unexpected control characters",
  });

export function validateGeneratedStory(value: string) {
  return generatedStorySchema.safeParse(value);
}

export const streamPhaseSchema = z.enum([
  "connecting",
  "open",
  "stalled",
  "retrying",
  "closed",
  "error",
]);

export const streamEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("sse"),
    event: z.string().optional(),
    id: z.string().optional(),
    data: z.string(),
    receivedAt: z.number(),
    deltaMs: z.number(),
  }),
  z.object({
    kind: z.literal("meta"),
    phase: streamPhaseSchema,
    detail: z.string().optional(),
  }),
  z.object({
    kind: z.literal("metric"),
    name: z.enum(["ttfb", "chunk", "retry", "rate_limit"]),
    value: z.number(),
  }),
]);

export type StreamPhase = z.infer<typeof streamPhaseSchema>;
export type StreamEvent = z.infer<typeof streamEventSchema>;