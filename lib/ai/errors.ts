export function isCreditsError(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown })?.message ?? error ?? ""
  ).toLowerCase();
  return (
    message.includes("402") ||
    message.includes("payment required") ||
    message.includes("insufficient") ||
    message.includes("credit") ||
    message.includes("quota")
  );
}

export class StoryOutputError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "StoryOutputError";
  }
}
