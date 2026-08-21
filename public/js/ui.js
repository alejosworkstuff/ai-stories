import { escapeHtml, stripCorpusCitations } from "./utils.js";
import {
  getStories,
  removeStoryById,
  toggleFavoriteById,
} from "./storage.js";
import { createTypewriter, prefersReducedMotion } from "./motion.js";
import {
  measureHistoryRects,
  playHistoryFlip,
  animateHistoryExitLeft,
  playHistoryExpandEntrance,
} from "./historyMotion.js";

const PREVIEW_LENGTH = 48;

let activeTypewriter = null;
let historyBusy = false;

function storyPreview(story) {
  const safeStory = stripCorpusCitations(story);
  return safeStory.length > PREVIEW_LENGTH
    ? safeStory.slice(0, PREVIEW_LENGTH) + "..."
    : safeStory;
}

function paintStoryText(outputEl, text) {
  if (!outputEl) return;
  outputEl.innerHTML = `<pre>${escapeHtml(stripCorpusCitations(text))}</pre>`;
}

function stopTypewriter({ snap = false } = {}) {
  if (!activeTypewriter) return;
  if (snap) activeTypewriter.finish();
  else activeTypewriter.destroy();
  activeTypewriter = null;
}

/**
 * @param {import("./storage.js").StoryEntry} entry
 * @param {number} index
 */
function createHistoryItem(entry, index) {
  const li = document.createElement("li");
  li.className = "history-item";
  li.dataset.id = entry.id;
  li.dataset.index = String(index);

  const text = document.createElement("span");
  text.className = "history-item__text";
  text.textContent = storyPreview(entry.text);

  const favoriteBtn = document.createElement("button");
  favoriteBtn.type = "button";
  favoriteBtn.className = entry.favorite
    ? "history-item__favorite is-active"
    : "history-item__favorite";
  favoriteBtn.setAttribute(
    "aria-label",
    entry.favorite ? "Unfavorite story" : "Favorite story"
  );
  favoriteBtn.setAttribute("aria-pressed", String(entry.favorite));
  favoriteBtn.title = entry.favorite ? "Unfavorite" : "Favorite";
  favoriteBtn.textContent = entry.favorite ? "★" : "☆";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "history-item__delete";
  deleteBtn.setAttribute("aria-label", "Delete story");
  deleteBtn.title = "Delete story";
  deleteBtn.textContent = "×";

  li.appendChild(text);
  li.appendChild(favoriteBtn);
  li.appendChild(deleteBtn);
  return li;
}

export function loadHistory(historyEl, { favoritesOnly = false, entrance = false } = {}) {
  if (!historyEl) return;

  const saved = getStories();
  const visible = saved
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !favoritesOnly || entry.favorite);

  const fragment = document.createDocumentFragment();
  visible.forEach(({ entry, index }) => {
    fragment.appendChild(createHistoryItem(entry, index));
  });

  historyEl.innerHTML = "";
  historyEl.appendChild(fragment);

  if (entrance) {
    playHistoryExpandEntrance(historyEl);
  }
}

/** Re-run expand fade/slide for currently visible rows. */
export function expandHistoryEntrance(historyEl) {
  playHistoryExpandEntrance(historyEl);
}

/**
 * @param {HTMLElement | null} historyEl
 * @param {string} id
 * @param {{ favoritesOnly?: boolean }} [options]
 */
export async function deleteHistoryItemAnimated(historyEl, id, { favoritesOnly = false } = {}) {
  if (!historyEl || historyBusy) return;
  const li = historyEl.querySelector(`.history-item[data-id="${CSS.escape(id)}"]`);
  if (!li) {
    removeStoryById(id);
    loadHistory(historyEl, { favoritesOnly });
    return;
  }

  historyBusy = true;
  try {
    const firstRects = measureHistoryRects(historyEl);
    await animateHistoryExitLeft(/** @type {HTMLElement} */ (li));
    removeStoryById(id);
    loadHistory(historyEl, { favoritesOnly });
    await playHistoryFlip(historyEl, firstRects);
  } finally {
    historyBusy = false;
  }
}

export async function toggleFavoriteAnimated(historyEl, id, { favoritesOnly = false } = {}) {
  if (!historyEl || historyBusy) return;
  const li = historyEl.querySelector(`.history-item[data-id="${CSS.escape(id)}"]`);
  if (!li) {
    toggleFavoriteById(id);
    loadHistory(historyEl, { favoritesOnly });
    return;
  }

  historyBusy = true;
  try {
    const wasFavorite = li.querySelector(".history-item__favorite.is-active") != null;
    const firstRects = measureHistoryRects(historyEl);
    const entry = toggleFavoriteById(id);
    if (!entry) return;

    const leavingFilteredView = favoritesOnly && wasFavorite && !entry.favorite;

    if (leavingFilteredView) {
      await animateHistoryExitLeft(/** @type {HTMLElement} */ (li));
      loadHistory(historyEl, { favoritesOnly });
      await playHistoryFlip(historyEl, firstRects);
      return;
    }

    loadHistory(historyEl, { favoritesOnly });
    await playHistoryFlip(historyEl, firstRects, {
      liftId: entry.favorite ? id : null,
    });
  } finally {
    historyBusy = false;
  }
}

export function handleHistoryClick(historyEl, onSelectStory) {
  if (!historyEl) return;

  historyEl.addEventListener("click", (e) => {
    if (
      e.target.closest(".history-item__delete") ||
      e.target.closest(".history-item__favorite")
    ) {
      return;
    }

    const li = e.target.closest("li");
    if (!li || li.parentElement !== historyEl) return;
    const id = li.dataset.id;
    if (!id) return;

    const saved = getStories();
    const entry = saved.find((item) => item.id === id);
    if (entry?.text) onSelectStory(entry.text);
  });
}

export function bindHistoryActions(historyEl, { onDeleteAt, onToggleFavorite }) {
  if (!historyEl) return;

  historyEl.addEventListener("click", (e) => {
    const favoriteBtn = e.target.closest(".history-item__favorite");
    if (favoriteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const li = favoriteBtn.closest("li");
      if (!li || li.parentElement !== historyEl) return;
      const id = li.dataset.id;
      if (!id) return;
      onToggleFavorite(id);
      return;
    }

    const deleteBtn = e.target.closest(".history-item__delete");
    if (!deleteBtn) return;

    e.preventDefault();
    e.stopPropagation();

    const li = deleteBtn.closest("li");
    if (!li || li.parentElement !== historyEl) return;
    const id = li.dataset.id;
    if (!id) return;

    onDeleteAt(id);
  });
}

/** @deprecated Use bindHistoryActions */
export function bindHistoryDelete(historyEl, _clearBtn, handlers) {
  bindHistoryActions(historyEl, handlers);
}

function triggerOutputReveal(outputEl) {
  if (!outputEl || prefersReducedMotion()) return;
  outputEl.classList.remove("is-revealing");
  // Force reflow so the entrance animation can replay.
  void outputEl.offsetWidth;
  outputEl.classList.add("is-revealing");
}

function ensureTypewriter(outputEl, { copyBtn, updateStats }) {
  if (activeTypewriter) return activeTypewriter;

  if (copyBtn) copyBtn.classList.remove("hidden");
  paintStoryText(outputEl, "");
  triggerOutputReveal(outputEl);
  outputEl.classList.add("is-typing");

  activeTypewriter = createTypewriter({
    onUpdate: (visible) => {
      paintStoryText(outputEl, visible);
      updateStats?.(visible);
    },
  });

  return activeTypewriter;
}

function clearTypingState(outputEl) {
  outputEl?.classList.remove("is-typing");
}

export function renderStory(output, { outputEl, copyBtn, statsEl, updateStats, animate = true }) {
  stopTypewriter({ snap: false });
  clearTypingState(outputEl);
  if (copyBtn) copyBtn.classList.remove("hidden");
  if (!outputEl) return;

  const text = stripCorpusCitations(
    Array.isArray(output) ? output.join("\n\n") : output
  );
  paintStoryText(outputEl, text);
  updateStats(text);
  if (animate) triggerOutputReveal(outputEl);
  outputEl.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

export function appendStoryChunk(text, { outputEl, copyBtn, statsEl, updateStats }) {
  if (!outputEl) return;
  const tw = ensureTypewriter(outputEl, { copyBtn, updateStats });
  tw.setTarget(stripCorpusCitations(text));
}

export async function completeStoryStream(text, { outputEl, copyBtn, statsEl, updateStats }) {
  if (!outputEl) return;
  const finalText = stripCorpusCitations(text);

  if (!activeTypewriter) {
    renderStory(finalText, { outputEl, copyBtn, statsEl, updateStats });
    return;
  }

  if (copyBtn) copyBtn.classList.remove("hidden");
  activeTypewriter.setTarget(finalText);
  await activeTypewriter.done();
  stopTypewriter({ snap: true });
  clearTypingState(outputEl);
  paintStoryText(outputEl, finalText);
  updateStats?.(finalText);
}

export function renderError(message, outputEl) {
  stopTypewriter({ snap: false });
  clearTypingState(outputEl);
  if (!outputEl) return;
  outputEl.innerHTML = `<p class="error-msg">${escapeHtml(message)}</p>`;
  triggerOutputReveal(outputEl);
}

export function renderGenerating(outputEl) {
  stopTypewriter({ snap: false });
  clearTypingState(outputEl);
  if (!outputEl) return;
  outputEl.innerHTML = "<p class='hint'>Generating story...</p>";
  triggerOutputReveal(outputEl);
}

export function updateStats(text, statsEl) {
  if (!statsEl) return;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  statsEl.innerHTML = `Words: ${words} | Characters: ${chars}`;
}

const TOAST_MS = 5000;

/** @type {HTMLElement | null} */
let activeAlertPill = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let alertPillTimer = null;

function clearAlertPillTimer() {
  if (alertPillTimer != null) {
    clearTimeout(alertPillTimer);
    alertPillTimer = null;
  }
}

function removeAlertPill() {
  clearAlertPillTimer();
  if (!activeAlertPill) return;
  const pill = activeAlertPill;
  activeAlertPill = null;
  pill.classList.add("is-leaving");
  const cleanup = () => pill.remove();
  pill.addEventListener("animationend", cleanup, { once: true });
  setTimeout(cleanup, 300);
}

function scheduleAlertPillDismiss() {
  clearAlertPillTimer();
  alertPillTimer = setTimeout(() => {
    removeAlertPill();
  }, TOAST_MS);
}

function shakeAlertPill(pill) {
  pill.classList.remove("is-shaking");
  void pill.offsetWidth;
  pill.classList.add("is-shaking");
  const onEnd = (event) => {
    if (event.animationName && !String(event.animationName).includes("shake")) return;
    pill.classList.remove("is-shaking");
    pill.removeEventListener("animationend", onEnd);
  };
  pill.addEventListener("animationend", onEnd);
}

/** @param {string} message */
export function showAlertPill(message) {
  const text = String(message || "").trim();
  if (!text) return;

  if (activeAlertPill && document.body.contains(activeAlertPill)) {
    const label = activeAlertPill.querySelector(".alert-pill__text");
    if (label) label.textContent = text;
    activeAlertPill.setAttribute("aria-label", text);
    shakeAlertPill(activeAlertPill);
    scheduleAlertPillDismiss();
    return;
  }

  const pill = document.createElement("div");
  pill.className = "alert-pill is-enter";
  pill.setAttribute("role", "status");
  pill.setAttribute("aria-live", "polite");
  pill.setAttribute("aria-label", text);
  pill.innerHTML = `<span class="alert-pill__text">${escapeHtml(text)}</span>`;
  pill.addEventListener(
    "animationend",
    (event) => {
      if (event.target !== pill) return;
      pill.classList.remove("is-enter");
    },
    { once: true }
  );

  activeAlertPill = pill;
  document.body.appendChild(pill);
  scheduleAlertPillDismiss();
}

/**
 * @param {{
 *   message?: string,
 * }} [options]
 * @returns {Promise<"all" | "unfavorited" | false>}
 */
export function showDeleteHistoryModal({
  message = "How do you want to clear story history?",
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fallback-overlay";
    overlay.innerHTML = `
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <p id="confirm-modal-title">${escapeHtml(message)}</p>
        <div class="confirm-modal__actions">
          <button class="confirm-ok" type="button" data-action="all">Delete all</button>
          <button class="confirm-ok confirm-ok--soft" type="button" data-action="unfavorited">Delete only unfavourite stories</button>
          <button class="confirm-cancel" type="button" data-action="cancel">Cancel</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      resolve(result);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") close(false);
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-action");
        if (action === "all") close("all");
        else if (action === "unfavorited") close("unfavorited");
        else close(false);
      });
    });
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    overlay.querySelector('[data-action="cancel"]')?.focus();
  });
}

/**
 * @param {{
 *   message: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 * }} options
 * @returns {Promise<boolean>}
 */
export function showConfirmModal({
  message,
  confirmLabel = "Delete all",
  cancelLabel = "Cancel",
}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "fallback-overlay";
    overlay.innerHTML = `
      <div class="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <p id="confirm-modal-title">${escapeHtml(message)}</p>
        <div class="confirm-modal__actions">
          <button class="confirm-cancel" type="button">${escapeHtml(cancelLabel)}</button>
          <button class="confirm-ok" type="button">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    function close(result) {
      overlay.remove();
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      resolve(result);
    }

    function onKeyDown(e) {
      if (e.key === "Escape") close(false);
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.querySelector(".confirm-cancel").addEventListener("click", () => close(false));
    overlay.querySelector(".confirm-ok").addEventListener("click", () => close(true));
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
    overlay.querySelector(".confirm-cancel")?.focus();
  });
}

export function setLoading(isLoading, { btn, regenBtn, continueBtn }) {
  if (btn) btn.disabled = isLoading;
  if (regenBtn) regenBtn.disabled = isLoading;
  if (continueBtn) continueBtn.disabled = isLoading;
  if (btn) btn.textContent = isLoading ? "Generating..." : "Create";
}
