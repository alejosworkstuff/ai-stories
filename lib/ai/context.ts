import type { StoryMessage } from "./schema.js";

export const MAX_COMPACTED_STORY_CHARS = 10_000;
const STORY_HEAD_CHARS = 2_000;
const STORY_CONTEXT_MARKER = "\n\n[Earlier story context compacted]\n\n";

export function compactStoryText(
  text: string,
  maxChars = MAX_COMPACTED_STORY_CHARS
): string {
  if (text.length <= maxChars) return text;

  const headChars = Math.min(STORY_HEAD_CHARS, Math.floor(maxChars / 2));
  const tailChars = Math.max(0, maxChars - headChars - STORY_CONTEXT_MARKER.length);
  return `${text.slice(0, headChars)}${STORY_CONTEXT_MARKER}${text.slice(-tailChars)}`;
}

export function compactStoryMessages(
  messages: ReadonlyArray<StoryMessage>
): StoryMessage[] {
  const assistantMessages = messages.filter((message) => message.role === "assistant");
  if (assistantMessages.length === 0) return [...messages];

  const firstUserMessage = messages.find((message) => message.role === "user");
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const story = compactStoryText(assistantMessages.map((message) => message.content).join("\n\n"));

  return [
    ...(firstUserMessage ? [firstUserMessage] : []),
    { role: "assistant", content: story },
    ...(latestUserMessage && latestUserMessage !== firstUserMessage ? [latestUserMessage] : []),
  ];
}
