import {
  ALLOWED_LENGTHS,
  ALLOWED_ROLES,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_MESSAGES,
  MAX_TONE_LENGTH,
} from "./ai/schema.js";

export { ALLOWED_LENGTHS, MAX_MESSAGE_CONTENT_LENGTH, MAX_TONE_LENGTH, MAX_MESSAGES };

const ALLOWED_LENGTH_SET = new Set<string>(ALLOWED_LENGTHS);
const ALLOWED_ROLE_SET = new Set<string>(ALLOWED_ROLES);

export interface ValidationError {
  error: string;
}

/**
 * Request validation with stable, client-facing error codes. (The Zod schema in
 * ai/schema.ts is used for typed parsing downstream; here we keep granular codes
 * the frontend's fallback messages and tests rely on.)
 */
export function validateGenerateRequest(body: unknown): ValidationError | null {
  const { messages, tone, length } = (body ?? {}) as {
    messages?: unknown;
    tone?: unknown;
    length?: unknown;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return { error: "messages_required" };
  }
  if (messages.length > MAX_MESSAGES) {
    return { error: "too_many_messages" };
  }

  for (const message of messages) {
    if (!message || typeof message !== "object") {
      return { error: "invalid_message" };
    }
    const { role, content } = message as { role?: unknown; content?: unknown };
    if (typeof role !== "string" || !ALLOWED_ROLE_SET.has(role)) {
      return { error: "invalid_message_role" };
    }
    if (typeof content !== "string" || !content.trim()) {
      return { error: "invalid_message_content" };
    }
    if (content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return { error: "message_too_long" };
    }
  }

  if (length !== undefined && (typeof length !== "string" || !ALLOWED_LENGTH_SET.has(length))) {
    return { error: "invalid_length" };
  }

  if (tone !== undefined) {
    if (typeof tone !== "string" || !tone.trim()) {
      return { error: "invalid_tone" };
    }
    if (tone.length > MAX_TONE_LENGTH) {
      return { error: "tone_too_long" };
    }
  }

  return null;
}
