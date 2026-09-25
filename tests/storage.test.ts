import { beforeEach, describe, expect, it } from "vitest";
import {
  findStoryById,
  getStories,
  saveStoryVersion,
  removeStoryById,
  toggleFavoriteById,
} from "../public/js/storage.js";

function installStorage() {
  const createStore = () => {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
    };
  };

  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: createStore() });
}

describe("nested story history", () => {
  beforeEach(installStorage);

  it("stores versions as children of the primary story", () => {
    const root = saveStoryVersion("The primary story.", { label: "A prompt" });
    const continuation = saveStoryVersion("The continuation.", {
      parentId: root!.id,
      label: "Continue story",
    });

    expect(getStories()).toEqual([
      {
        id: root!.id,
        text: "The primary story.",
        favorite: false,
        label: "A prompt",
        children: [
          {
            id: continuation!.id,
            text: "The continuation.",
            favorite: false,
            label: "Continue story",
            children: [],
          },
        ],
      },
    ]);
    expect(findStoryById(continuation!.id)?.rootId).toBe(root!.id);
  });

  it("removes a child without removing its primary story", () => {
    const root = saveStoryVersion("Root");
    const child = saveStoryVersion("Alternative", { parentId: root!.id });

    expect(removeStoryById(child!.id)).toBe(true);
    expect(getStories()).toHaveLength(1);
    expect(getStories()[0]?.children).toEqual([]);
  });
});

describe("favorite story ordering", () => {
  beforeEach(installStorage);

  it("pins favorites before other stories and returns unfavorited stories to the boundary", () => {
    const oldest = saveStoryVersion("Oldest story")!;
    const middle = saveStoryVersion("Middle story")!;
    const newest = saveStoryVersion("Newest story")!;

    toggleFavoriteById(oldest.id);
    expect(getStories().map((story) => story.text)).toEqual([
      "Oldest story",
      "Newest story",
      "Middle story",
    ]);

    toggleFavoriteById(middle.id);
    expect(getStories().map((story) => story.text)).toEqual([
      "Middle story",
      "Oldest story",
      "Newest story",
    ]);

    toggleFavoriteById(middle.id);
    expect(getStories().map((story) => story.text)).toEqual([
      "Oldest story",
      "Middle story",
      "Newest story",
    ]);
  });
});
