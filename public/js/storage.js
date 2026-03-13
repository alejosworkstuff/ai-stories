import { STORAGE_KEYS, MAX_HISTORY } from "./constants.js";

export function getStories() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.storyHistory)) || [];
  } catch {
    return [];
  }
}

export function saveStory(story) {
  const saved = getStories();
  saved.unshift(String(story));
  if (saved.length > MAX_HISTORY) {
    saved.pop();
  }
  localStorage.setItem(STORAGE_KEYS.storyHistory, JSON.stringify(saved));
}
