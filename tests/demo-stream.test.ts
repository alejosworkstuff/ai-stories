import { describe, expect, it } from "vitest";
import { createDemoStreamHandler } from "../api/demo-stream";

function createMockResponse() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    ended: false,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
      return true;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe("demo-stream handler", () => {
  it("rejects non-GET requests", async () => {
    const response = createMockResponse();
    await createDemoStreamHandler({ delayMs: 0 })({ method: "POST" }, response);
    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toBe("GET");
    expect(response.ended).toBe(true);
  });

  it("emits token events and a clean done event", async () => {
    const response = createMockResponse();
    await createDemoStreamHandler({ delayMs: 0 })({ method: "GET" }, response);
    const body = response.chunks.join("");

    expect(response.statusCode).toBe(200);
    expect(response.headers["Content-Type"]).toContain("text/event-stream");
    expect(body).toContain('event: token\ndata: {"type":"token","text":"Once "}\n\n');
    expect(body).toContain('event: done\ndata: {"type":"done"}\n\n');
    expect(response.ended).toBe(true);
  });
});
