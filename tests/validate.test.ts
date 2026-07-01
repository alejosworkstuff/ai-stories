import { describe, it, expect } from "vitest";
import {
  validateGenerateRequest,
  MAX_MESSAGE_CONTENT_LENGTH,
  MAX_MESSAGES,
} from "../lib/validate";

describe("validateGenerateRequest", () => {
  it("accepts valid payloads", () => {
    expect(
      validateGenerateRequest({
        messages: [{ role: "user", content: "A dragon wakes up." }],
        tone: "romantic cyberpunk",
        length: "medium",
      })
    ).toBeNull();
  });

  it("requires at least one message", () => {
    expect(validateGenerateRequest({ messages: [] })).toEqual({
      error: "messages_required",
    });
  });

  it("rejects too many messages", () => {
    const messages = Array.from({ length: MAX_MESSAGES + 1 }, () => ({
      role: "user",
      content: "x",
    }));
    expect(validateGenerateRequest({ messages })).toEqual({
      error: "too_many_messages",
    });
  });

  it("rejects invalid roles", () => {
    expect(
      validateGenerateRequest({ messages: [{ role: "system", content: "x" }] })
    ).toEqual({ error: "invalid_message_role" });
  });

  it("rejects unknown length values", () => {
    expect(
      validateGenerateRequest({
        messages: [{ role: "user", content: "seed" }],
        length: "huge",
      })
    ).toEqual({ error: "invalid_length" });
  });

  it("rejects oversized message content", () => {
    expect(
      validateGenerateRequest({
        messages: [{ role: "user", content: "x".repeat(MAX_MESSAGE_CONTENT_LENGTH + 1) }],
      })
    ).toEqual({ error: "message_too_long" });
  });

  it("rejects empty tone strings", () => {
    expect(
      validateGenerateRequest({
        messages: [{ role: "user", content: "seed" }],
        tone: "   ",
      })
    ).toEqual({ error: "invalid_tone" });
  });
});
