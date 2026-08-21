import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSession,
  createSessionId,
  loadSession,
  saveSession,
} from "../public/js/storage.js";

function installSessionStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      setItem(key: string, value: string) {
        store.set(key, String(value));
      },
      removeItem(key: string) {
        store.delete(key);
      },
      clear() {
        store.clear();
      },
    },
  });
}

describe("session memory", () => {
  beforeEach(() => {
    installSessionStorage();
  });

  it("round-trips conversation state", () => {
    const sessionId = createSessionId();
    saveSession({
      sessionId,
      messages: [
        { role: "user", content: "A violinist in Buenos Aires" },
        { role: "assistant", content: "The city hummed." },
      ],
      seed: "A violinist in Buenos Aires",
      tone: "romantic cyberpunk",
      length: "medium",
    });

    expect(loadSession()).toEqual({
      sessionId,
      messages: [
        { role: "user", content: "A violinist in Buenos Aires" },
        { role: "assistant", content: "The city hummed." },
      ],
      seed: "A violinist in Buenos Aires",
      tone: "romantic cyberpunk",
      length: "medium",
    });
  });

  it("clears session state", () => {
    saveSession({
      sessionId: createSessionId(),
      messages: [{ role: "user", content: "seed" }],
      seed: "seed",
      tone: "noir",
      length: "short",
    });
    clearSession();
    expect(loadSession()).toBeNull();
  });
});
