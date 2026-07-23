import { STORAGE_KEYS, MAX_HISTORY } from "./constants.js";

/**
 * @typedef {{ id: string, text: string, favorite: boolean }} StoryEntry
 */

export function createStoryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {unknown} entry @returns {StoryEntry} */
export function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return { id: createStoryId(), text: entry, favorite: false };
  }
  if (entry && typeof entry === "object") {
    const raw = /** @type {{ id?: unknown, text?: unknown, favorite?: unknown }} */ (entry);
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createStoryId(),
      text: String(raw.text ?? ""),
      favorite: Boolean(raw.favorite),
    };
  }
  return { id: createStoryId(), text: "", favorite: false };
}

/** @returns {StoryEntry[]} */
export function getStories() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEYS.storyHistory)) || [];
    if (!Array.isArray(raw)) return [];

    let dirty = false;
    const entries = raw
      .map((entry) => {
        const before = entry && typeof entry === "object" ? /** @type {{ id?: unknown }} */ (entry).id : null;
        const normalized = normalizeEntry(entry);
        if (!before) dirty = true;
        return normalized;
      })
      .filter((entry) => entry.text.length > 0);

    if (dirty && entries.length > 0) {
      persist(entries);
    }
    return entries;
  } catch {
    return [];
  }
}

/** @param {StoryEntry[]} entries */
function persist(entries) {
  localStorage.setItem(STORAGE_KEYS.storyHistory, JSON.stringify(entries));
}

export function saveStory(story) {
  const text = String(story);
  if (!text) return null;

  const saved = getStories();
  const entry = { id: createStoryId(), text, favorite: false };
  saved.unshift(entry);
  while (saved.length > MAX_HISTORY) {
    const dropAt = [...saved.keys()].reverse().find((i) => !saved[i].favorite);
    if (dropAt == null) saved.pop();
    else saved.splice(dropAt, 1);
  }
  persist(saved);
  return entry;
}

export function removeStoryAt(index) {
  const saved = getStories();
  if (index < 0 || index >= saved.length) return false;
  saved.splice(index, 1);
  persist(saved);
  return true;
}

export function removeStoryById(id) {
  const saved = getStories();
  const index = saved.findIndex((entry) => entry.id === id);
  if (index === -1) return false;
  saved.splice(index, 1);
  persist(saved);
  return true;
}

/** @returns {StoryEntry | null} */
export function toggleFavoriteAt(index) {
  const saved = getStories();
  if (index < 0 || index >= saved.length) return null;

  const [entry] = saved.splice(index, 1);
  entry.favorite = !entry.favorite;

  if (entry.favorite) {
    saved.unshift(entry);
  } else {
    const firstNonFavorite = saved.findIndex((item) => !item.favorite);
    if (firstNonFavorite === -1) saved.push(entry);
    else saved.splice(firstNonFavorite, 0, entry);
  }

  persist(saved);
  return entry;
}

/** @returns {StoryEntry | null} */
export function toggleFavoriteById(id) {
  const saved = getStories();
  const index = saved.findIndex((entry) => entry.id === id);
  if (index === -1) return null;
  return toggleFavoriteAt(index);
}

export function clearStories() {
  localStorage.removeItem(STORAGE_KEYS.storyHistory);
}

/** Keep favorites; remove everything else. @returns {number} removed count */
export function clearNonFavorites() {
  const saved = getStories();
  const kept = saved.filter((entry) => entry.favorite);
  const removed = saved.length - kept.length;
  if (removed === 0) return 0;
  persist(kept);
  return removed;
}
