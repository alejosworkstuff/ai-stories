export const ALLOWED_LENGTHS = new Set(["short", "medium", "long"]);
export const ALLOWED_ROLES = new Set(["user", "assistant"]);
export const MAX_MESSAGE_CONTENT_LENGTH = 500;
export const MAX_TONE_LENGTH = 120;
export const MAX_MESSAGES = 20;

export function validateGenerateRequest(body) {
  const { messages, tone, length } = body || {};

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
    if (!ALLOWED_ROLES.has(message.role)) {
      return { error: "invalid_message_role" };
    }
    if (typeof message.content !== "string" || !message.content.trim()) {
      return { error: "invalid_message_content" };
    }
    if (message.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return { error: "message_too_long" };
    }
  }

  if (length !== undefined && !ALLOWED_LENGTHS.has(length)) {
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
