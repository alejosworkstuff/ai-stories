import { escapeHtml } from "./utils.js";
import { getStories } from "./storage.js";

const PREVIEW_LENGTH = 60;

function storyPreview(story) {
  const safeStory = String(story);
  return safeStory.length > PREVIEW_LENGTH
    ? safeStory.slice(0, PREVIEW_LENGTH) + "..."
    : safeStory;
}

export function loadHistory(historyEl, clearBtn) {
  if (!historyEl) return;

  const saved = getStories();
  const fragment = document.createDocumentFragment();

  saved.forEach((story, index) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.dataset.index = String(index);

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

export function renderStory(output, { outputEl, copyBtn, statsEl, updateStats }) {
  if (copyBtn) copyBtn.classList.remove("hidden");
  if (!outputEl) return;

  const text = Array.isArray(output) ? output.join("\n\n") : output;
  outputEl.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
  updateStats(text);
  outputEl.scrollIntoView({ behavior: "smooth" });
}

// Live render of the accumulated token stream (escaped on every update).
export function appendStoryChunk(text, { outputEl, copyBtn, statsEl, updateStats }) {
  if (copyBtn) copyBtn.classList.remove("hidden");
  if (!outputEl) return;
  outputEl.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
  updateStats(text);
}

export function renderError(message, outputEl) {
  if (!outputEl) return;
  outputEl.innerHTML = `<p class="error-msg">${escapeHtml(message)}</p>`;
}

export function renderGenerating(outputEl) {
  if (!outputEl) return;
  outputEl.innerHTML = "<p class='hint'>Generating story...</p>";
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
