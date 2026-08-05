import { z } from "zod";

export const ALLOWED_LENGTHS = ["short", "medium", "long"] as const;
export type StoryLength = (typeof ALLOWED_LENGTHS)[number];

export const ALLOWED_ROLES = ["user", "assistant"] as const;
export type MessageRole = (typeof ALLOWED_ROLES)[number];

/** Per-message cap for request validation. Must fit model output from Create so Continue can resend prior turns; not a Groq hard limit. */
export const MAX_MESSAGE_CONTENT_LENGTH = 4000;
export const MAX_TONE_LENGTH = 120;
export const MAX_MESSAGES = 20;

export const messageSchema = z.object({
  role: z.enum(ALLOWED_ROLES),
  content: z.string().min(1).max(MAX_MESSAGE_CONTENT_LENGTH),
});
export type StoryMessage = z.infer<typeof messageSchema>;

export const generateRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  tone: z.string().min(1).max(MAX_TONE_LENGTH).optional(),
  length: z.enum(ALLOWED_LENGTHS).optional(),
  sessionId: z.string().uuid().optional(),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/**
 * Structured story output used by `generateObject` and the eval harness.
 * Demonstrates typed LLM outputs (Zod-validated, not free text).
 */
export const storySchema = z.object({
  title: z.string().min(1).max(120),
  paragraphs: z.array(z.string().min(1)).min(1),
  choices: z.array(z.string().min(1)).min(2).max(4),
  groundedOn: z.array(z.string()).default([]),
});
export type Story = z.infer<typeof storySchema>;
