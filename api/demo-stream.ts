import { writeStreamEvent, type ResponseSink } from "../lib/ai/agent.js";

interface DemoRequest {
  method?: string;
  on?: (event: "close", listener: () => void) => void;
}

interface DemoResponse extends ResponseSink {
  status(code: number): DemoResponse;
}

interface DemoStreamDeps {
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const DEMO_TOKENS = ["Once ", "upon ", "a ", "time, ", "a ", "quiet ", "signal ", "became ", "a ", "story."];
const DEFAULT_DELAY_MS = 90;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createDemoStreamHandler(deps: DemoStreamDeps = {}) {
  const delayMs = deps.delayMs ?? DEFAULT_DELAY_MS;
  const sleep = deps.sleep ?? wait;

  return async function demoStreamHandler(req: DemoRequest, res: DemoResponse): Promise<void> {
    if (req.method !== "GET") {
      res.status(405);
      res.setHeader("Allow", "GET");
      res.end();
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    let closed = false;
    req.on?.("close", () => {
      closed = true;
    });

    for (const text of DEMO_TOKENS) {
      if (closed) return;
      if (delayMs > 0) await sleep(delayMs);
      if (!writeStreamEvent(res, { type: "token", text })) return;
    }

    if (!closed) writeStreamEvent(res, { type: "done" });
    if (!closed) res.end();
  };
}

export default createDemoStreamHandler();
