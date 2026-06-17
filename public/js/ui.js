import { escapeHtml } from "./utils.js";
import { getStories } from "./storage.js";

const PREVIEW_LENGTH = 60;

export function loadHistory(historyEl) {
  if (!historyEl) return;

  const saved = getStories();
  const fragment = document.createDocumentFragment();

  saved.forEach((story, index) => {
    const safeStory = String(story);
    const li = document.createElement("li");
    li.textContent =
      safeStory.length > PREVIEW_LENGTH
        ? safeStory.slice(0, PREVIEW_LENGTH) + "..."
        : safeStory;
    li.dataset.index = String(index);
    fragment.appendChild(li);
  });

  historyEl.innerHTML = "";
  historyEl.appendChild(fragment);
}

export function handleHistoryClick(historyEl, onSelectStory) {
  if (!historyEl) return;

  historyEl.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li || li.parentElement !== historyEl) return;
    const index = li.dataset.index;
    if (index == null) return;

    const saved = getStories();
    const story = saved[parseInt(index, 10)];
    if (story != null) onSelectStory(String(story));
  });
}

export function renderStory(output, { outputEl, copyBtn, statsEl, updateStats }) {
  if (copyBtn) copyBtn.style.display = "block";
  if (!outputEl) return;

  const text = Array.isArray(output) ? output.join("\n\n") : output;
  outputEl.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
  updateStats(text);
  outputEl.scrollIntoView({ behavior: "smooth" });
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
