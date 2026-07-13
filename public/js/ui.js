import { escapeHtml } from "./utils.js";
import { getStories } from "./storage.js";
import {
  createTypewriter,
  observeStaggerInView,
  prefersReducedMotion,
} from "./motion.js";

const PREVIEW_LENGTH = 60;

let activeTypewriter = null;
let disconnectHistoryObserver = null;

function storyPreview(story) {
  const safeStory = String(story);
  return safeStory.length > PREVIEW_LENGTH
    ? safeStory.slice(0, PREVIEW_LENGTH) + "..."
    : safeStory;
}

function paintStoryText(outputEl, text) {
  if (!outputEl) return;
  outputEl.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
}

function stopTypewriter({ snap = false } = {}) {
  if (!activeTypewriter) return;
  if (snap) activeTypewriter.finish();
  else activeTypewriter.destroy();
  activeTypewriter = null;
}

export function loadHistory(historyEl, clearBtn) {
  if (!historyEl) return;

  disconnectHistoryObserver?.();
  disconnectHistoryObserver = null;

  const saved = getStories();
  const fragment = document.createDocumentFragment();
  const reduced = prefersReducedMotion();

  saved.forEach((story, index) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.dataset.index = String(index);
    li.style.setProperty("--stagger", String(Math.min(index, 12)));

    if (reduced) {
      li.classList.add("history-item--in");
    } else {
      li.classList.add("history-item--pending");
    }

    const text = document.createElement("span");
    text.className = "history-item__text";
    text.textContent = storyPreview(story);

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "history-item__delete";
    deleteBtn.setAttribute("aria-label", "Delete story");
    deleteBtn.title = "Delete story";
    deleteBtn.textContent = "×";

    li.appendChild(text);
    li.appendChild(deleteBtn);
    fragment.appendChild(li);
  });

  historyEl.innerHTML = "";
  historyEl.appendChild(fragment);

  if (!reduced) {
    disconnectHistoryObserver = observeStaggerInView(historyEl);
  }

  if (clearBtn) {
    clearBtn.disabled = saved.length === 0;
  }
}

export function handleHistoryClick(historyEl, onSelectStory) {
  if (!historyEl) return;

  historyEl.addEventListener("click", (e) => {
    if (e.target.closest(".history-item__delete")) return;

    const li = e.target.closest("li");
    if (!li || li.parentElement !== historyEl) return;
    const index = li.dataset.index;
    if (index == null) return;

    const saved = getStories();
    const story = saved[parseInt(index, 10)];
    if (story != null) onSelectStory(String(story));
  });
}

export function bindHistoryDelete(historyEl, clearBtn, { onDeleteAt, onClearAll }) {
  if (historyEl) {
    historyEl.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".history-item__delete");
      if (!deleteBtn) return;

      e.preventDefault();
      e.stopPropagation();

      const li = deleteBtn.closest("li");
      if (!li || li.parentElement !== historyEl) return;
      const index = li.dataset.index;
      if (index == null) return;

      onDeleteAt(parseInt(index, 10));
    });
  }

  clearBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (clearBtn.disabled) return;
    onClearAll();
  });
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

/** Instant full render (history restore, final snap, errors). */
export function renderStory(output, { outputEl, copyBtn, statsEl, updateStats, animate = true }) {
  stopTypewriter({ snap: false });
  clearTypingState(outputEl);
  if (copyBtn) copyBtn.classList.remove("hidden");
  if (!outputEl) return;

  const text = Array.isArray(output) ? output.join("\n\n") : output;
  paintStoryText(outputEl, text);
  updateStats(text);
  if (animate) triggerOutputReveal(outputEl);
  outputEl.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/**
 * Feed the live stream into the typewriter. Accumulated `text` is the target;
 * characters reveal with spring catch-up toward that target.
 */
export function appendStoryChunk(text, { outputEl, copyBtn, statsEl, updateStats }) {
  if (!outputEl) return;
  const tw = ensureTypewriter(outputEl, { copyBtn, updateStats });
  tw.setTarget(text);
}

/** Wait for the typewriter to catch up to `text`, then clear the stream session. */
export async function completeStoryStream(text, { outputEl, copyBtn, statsEl, updateStats }) {
  if (!outputEl) return;
  const finalText = String(text ?? "");

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

export function showFallbackModal(message) {
  const overlay = document.createElement("div");
  overlay.className = "fallback-overlay";
  overlay.innerHTML = `
    <div class="fallback-modal">
      <p>${escapeHtml(message)}</p>
      <button class="fallback-dismiss" type="button">OK</button>
    </div>
  `;

  function dismiss() {
    overlay.remove();
    document.body.style.overflow = "";
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) dismiss();
  });
  overlay.querySelector(".fallback-dismiss").addEventListener("click", dismiss);
  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
}

export function setLoading(isLoading, { btn, regenBtn, continueBtn }) {
  if (btn) btn.disabled = isLoading;
  if (regenBtn) regenBtn.disabled = isLoading;
  if (continueBtn) continueBtn.disabled = isLoading;
  if (btn) btn.textContent = isLoading ? "Generating..." : "Create";
}
