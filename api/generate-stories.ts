import {
  createRateLimiter,
  type MinimalRequest,
  type RateLimiter,
} from "../lib/rate-limit";
import { validateGenerateRequest } from "../lib/validate";
import { screenMessages } from "../lib/ai/guardrails";
import {
  createStoryStreamer,
  type GenerateParams,
  type GenerationResult,
  type ResponseSink,
} from "../lib/ai/agent";

interface RequestLike extends MinimalRequest {
  method?: string;
  body?: unknown;
}

interface ResponseLike extends ResponseSink {
  status(code: number): ResponseLike;
  json(body: unknown): unknown;
}

export interface HandlerDeps {
  rateLimiter?: RateLimiter;
  generate?: (params: GenerateParams, res: ResponseSink) => Promise<GenerationResult>;
}

export function createHandler(deps: HandlerDeps = {}) {
  const rateLimiter = deps.rateLimiter ?? createRateLimiter();
  const generate = deps.generate ?? createStoryStreamer();

  return async function handler(req: RequestLike, res: ResponseLike): Promise<unknown> {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "method_not_allowed" });
    }

    const rateLimit = rateLimiter.check(req);
    res.setHeader("X-RateLimit-Remaining", String(rateLimit.remaining));
    if (!rateLimit.allowed) {
      res.setHeader("Retry-After", String(rateLimit.retryAfterSec));
      return res.status(429).json({ error: "rate_limit_exceeded" });
    }

    const body = (req.body ?? {}) as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
      tone?: string;
      length?: string;
      sessionId?: string;
    };

    const validationError = validateGenerateRequest(body);
    if (validationError) {
      return res.status(400).json(validationError);
    }

    const injection = screenMessages(body.messages ?? []);
    if (injection.flagged) {
      return res.status(400).json({ error: "unsafe_request" });
    }

    const result = await generate(
      {
        messages: body.messages ?? [],
        tone: body.tone,
        length: body.length,
        sessionId: body.sessionId,
      },
      res
    );

    if (!result.streamed) {
      return res.status(result.status ?? 500).json({
        error: result.errorCode ?? "generation_failed",
      });
    }

    return undefined;
  };
}

export default createHandler();
