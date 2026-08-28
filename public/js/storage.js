import { STORAGE_KEYS, MAX_HISTORY } from "./constants.js";

/**
 * @typedef {{ id: string, text: string, favorite: boolean, label?: string, children?: StoryEntry[] }} StoryEntry
 */

/**
 * @typedef {{
 *   sessionId: string,
 *   messages: Array<{ role: "user" | "assistant", content: string }>,
 *   seed: string,
 *   tone: string,
 *   length: string,
 *   historyRootId?: string,
 * }} SessionState
 */

export function createStoryId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createSessionId() {
  return createStoryId();
}

/** @returns {SessionState | null} */
export function loadSession() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.session) || "null");
    if (!raw || typeof raw !== "object") return null;

    const sessionId = typeof raw.sessionId === "string" && raw.sessionId ? raw.sessionId : null;
    if (!sessionId) return null;

    const messages = Array.isArray(raw.messages)
      ? raw.messages
          .filter(
            (message) =>
              message &&
              typeof message === "object" &&
              (message.role === "user" || message.role === "assistant") &&
              typeof message.content === "string" &&
              message.content.trim()
          )
          .map((message) => ({
            role: /** @type {"user" | "assistant"} */ (message.role),
            content: String(message.content),
          }))
      : [];

    return {
      sessionId,
      messages,
      seed: typeof raw.seed === "string" ? raw.seed : "",
      tone: typeof raw.tone === "string" ? raw.tone : "",
      length: typeof raw.length === "string" ? raw.length : "short",
      ...(typeof raw.historyRootId === "string" ? { historyRootId: raw.historyRootId } : {}),
    };
  } catch {
    return null;
  }
}

/** @param {SessionState} state */
export function saveSession(state) {
  if (!state?.sessionId) return;
  sessionStorage.setItem(
    STORAGE_KEYS.session,
    JSON.stringify({
      sessionId: state.sessionId,
      messages: Array.isArray(state.messages) ? state.messages : [],
      seed: String(state.seed ?? ""),
      tone: String(state.tone ?? ""),
      length: String(state.length ?? "short"),
      ...(state.historyRootId ? { historyRootId: state.historyRootId } : {}),
    })
  );
}

export function clearSession() {
  sessionStorage.removeItem(STORAGE_KEYS.session);
}

/** @param {unknown} entry @returns {StoryEntry} */
export function normalizeEntry(entry) {
  if (typeof entry === "string") {
    return { id: createStoryId(), text: entry, favorite: false, children: [] };
  }
  if (entry && typeof entry === "object") {
    const raw = /** @type {{ id?: unknown, text?: unknown, favorite?: unknown, label?: unknown, children?: unknown }} */ (entry);
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : createStoryId(),
      text: String(raw.text ?? ""),
      favorite: Boolean(raw.favorite),
      ...(typeof raw.label === "string" && raw.label ? { label: raw.label } : {}),
      children: Array.isArray(raw.children)
        ? raw.children.map(normalizeEntry).filter((child) => child.text.length > 0)
        : [],
    };
  }
  return { id: createStoryId(), text: "", favorite: false, children: [] };
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
  return saveStoryVersion(story);
}

export function saveStoryVersion(story, { parentId = null, label = "" } = {}) {
  const text = String(story);
  if (!text) return null;

  const saved = getStories();
  if (parentId) {
    const parent = findStory(saved, parentId);
    if (!parent) return null;
    const existing = parent.entry.children?.find((child) => child.text === text);
    if (existing) return existing;
    const entry = {
      id: createStoryId(),
      text,
      favorite: false,
      ...(label ? { label } : {}),
      children: [],
    };
    parent.entry.children ??= [];
    parent.entry.children.unshift(entry);
    persist(saved);
    return entry;
  }

  if (saved[0]?.text === text) return saved[0];
  const entry = {
    id: createStoryId(),
    text,
    favorite: false,
    ...(label ? { label } : {}),
    children: [],
  };
  saved.unshift(entry);
  while (saved.length > MAX_HISTORY) {
    const dropAt = [...saved.keys()].reverse().find((i) => !saved[i].favorite);
    if (dropAt == null) saved.pop();
    else saved.splice(dropAt, 1);
  }
  persist(saved);
  return entry;
}

function findStory(entries, id, rootId = null) {
  for (const entry of entries) {
    if (entry.id === id) return { entry, rootId: rootId ?? entry.id };
    const found = findStory(entry.children ?? [], id, rootId ?? entry.id);
    if (found) return found;
  }
  return null;
}

export function findStoryById(id) {
  return findStory(getStories(), id);
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
  const found = findStory(saved, id);
  if (!found) return false;
  if (found.rootId === id) {
    const index = saved.findIndex((entry) => entry.id === id);
    saved.splice(index, 1);
  } else {
    const parent = findStory(saved, found.rootId);
    const index = parent?.entry.children?.findIndex((entry) => entry.id === id) ?? -1;
    if (!parent || index < 0) return false;
    parent.entry.children?.splice(index, 1);
  }
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
  const found = findStory(saved, id);
  if (!found) return null;
  found.entry.favorite = !found.entry.favorite;
  persist(saved);
  return found.entry;
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
