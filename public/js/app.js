import { whenReady, stripCorpusCitations } from "./utils.js";
import { RANDOM_SEEDS } from "./constants.js";
import {
  saveStory,
  saveStoryVersion,
  findStoryById,
  clearStories,
  clearNonFavorites,
  getStories,
  loadSession,
  saveSession,
  createSessionId,
} from "./storage.js";
import { streamStory } from "./api.js";
import { initStreamScope } from "./streamscope.js";
import { normalizeApiError } from "./http.js";
import { generateLocalStory } from "./localGenerator.js";
import { generateLocalContinuation } from "./localGenerator.js";
import { compactStoryMessages } from "./story-context.js";
import { initDarkMode, toggleDarkMode } from "./theme.js";
import { initHudResize } from "./hud-resize.js";
import {
  loadHistory,
  expandHistoryEntrance,
  deleteHistoryItemAnimated,
  toggleFavoriteAnimated,
  handleHistoryClick,
  bindHistoryActions,
  renderStory,
  appendStoryChunk,
  completeStoryStream,
  renderError,
  renderGenerating,
  updateStats,
  showAlertPill,
  showDeleteHistoryModal,
  setLoading,
} from "./ui.js";

const ELEMENTS = {
  btn: document.getElementById("btn"),
  seedEl: document.getElementById("seed"),
  toneEl: document.getElementById("tone"),
  lengthEl: document.getElementById("length"),
  lengthDropdown: document.getElementById("lengthDropdown"),
  lengthToggle: document.getElementById("lengthToggle"),
  lengthValue: document.getElementById("lengthValue"),
  lengthOptions: document.getElementById("lengthOptions"),
  continuePromptEl: document.getElementById("continuePrompt"),
  continueBtn: document.getElementById("continueBtn"),
  out: document.getElementById("output"),
  copyBtn: document.getElementById("copyBtn"),
  stats: document.getElementById("stats"),
  regenBtn: document.getElementById("regenBtn"),
  historyEl: document.getElementById("history"),
  historyBox: document.getElementById("historyBox"),
  historyToggleBtn: document.getElementById("toggleHistory"),
  historyMenu: document.getElementById("historyMenu"),
  historyMenuToggle: document.getElementById("historyMenuToggle"),
  historyMenuList: document.getElementById("historyMenuList"),
  historyFilterFavorites: document.getElementById("historyFilterFavorites"),
  historyDeleteMenu: document.getElementById("historyDeleteMenu"),
  themeToggle: document.getElementById("themeToggle"),
  streamscopeToggle: document.getElementById("streamscopeToggle"),
  streamscopePanel: document.getElementById("streamscopePanel"),
  outputResizeHandle: document.getElementById("outputResizeHandle"),
  streamscopeStatus: document.getElementById("streamscopeStatus"),
  streamscopeEventLog: document.getElementById("streamscopeEventLog"),
};

const GENRE_REQUIRED_MESSAGE = "Add a genre to create a story.";

let messages = [];
let sessionId = createSessionId();
let favoritesOnly = false;
let streamScope = null;
let historyRootId = null;

const FALLBACK_MESSAGE = {
  CREDITS: "Out of credits - generating fallback story",
  RATE_LIMIT: "Too many requests - using local generator",
  VALIDATION: "Invalid request - using local generator",
  SERVER: "AI service error - using local generator",
  HTTP: "AI unavailable - using local generator",
};

function getValidationMessage(error, isContinuation) {
  if (error === "message_too_long" && isContinuation) {
    return "This story is too long to continue. Regenerate it with Short, then try Continue again.";
  }
  return `Request rejected: ${error || "invalid request"}.`;
}

function refreshHistory({ entrance = false } = {}) {
  loadHistory(ELEMENTS.historyEl, { favoritesOnly, entrance });
  syncHistoryMenu();
}

function setHistoryMenuOpen(isOpen) {
  ELEMENTS.historyMenu?.classList.toggle("is-open", isOpen);
  ELEMENTS.historyMenuToggle?.setAttribute("aria-expanded", String(isOpen));
}

function syncHistoryMenu() {
  const hasStories = getStories().length > 0;
  if (ELEMENTS.historyDeleteMenu) {
    ELEMENTS.historyDeleteMenu.disabled = !hasStories;
  }
  if (ELEMENTS.historyFilterFavorites) {
    ELEMENTS.historyFilterFavorites.textContent = favoritesOnly
      ? "Show all stories"
      : "Show only favorites";
  }
}

function generateRandomSeed() {
  const randomIndex = Math.floor(Math.random() * RANDOM_SEEDS.length);
  if (ELEMENTS.seedEl) ELEMENTS.seedEl.value = RANDOM_SEEDS[randomIndex];
}

function getStoryText() {
  return messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content)
    .join("\n\n");
}

function hasActiveConversation() {
  return messages.some((message) => message.role === "assistant");
}

function setContinueEnabled(enabled) {
  if (!ELEMENTS.continueBtn) return;
  ELEMENTS.continueBtn.disabled = !enabled;
}

function persistSession() {
  saveSession({
    sessionId,
    messages,
    seed: ELEMENTS.seedEl?.value ?? "",
    tone: ELEMENTS.toneEl?.value ?? "",
    length: ELEMENTS.lengthEl?.value ?? "short",
    historyRootId,
  });
}

function applyLengthToUi(length) {
  if (!ELEMENTS.lengthEl || !ELEMENTS.lengthValue || !ELEMENTS.lengthOptions) return;
  const allowed = new Set(["short", "medium", "long"]);
  const value = allowed.has(length) ? length : "short";
  ELEMENTS.lengthEl.value = value;

  const optionButton = ELEMENTS.lengthOptions.querySelector(`[data-value="${value}"]`);
  if (optionButton) {
    ELEMENTS.lengthValue.textContent = optionButton.textContent;
    ELEMENTS.lengthOptions.querySelectorAll("[role='option']").forEach((option) => {
      option.setAttribute("aria-selected", String(option.contains(optionButton)));
    });
  }
}

function restoreSession() {
  const saved = loadSession();
  if (!saved) return false;

  sessionId = saved.sessionId || createSessionId();
  messages = saved.messages ?? [];
  historyRootId = saved.historyRootId || null;

  if (ELEMENTS.seedEl && saved.seed) ELEMENTS.seedEl.value = saved.seed;
  if (ELEMENTS.toneEl && saved.tone) ELEMENTS.toneEl.value = saved.tone;
  applyLengthToUi(saved.length || "short");

  if (hasActiveConversation()) {
    const fullStory = getStoryText();
    renderStory(fullStory, {
      outputEl: ELEMENTS.out,
      copyBtn: ELEMENTS.copyBtn,
      statsEl: ELEMENTS.stats,
      updateStats: (text) => updateStats(text, ELEMENTS.stats),
      animate: false,
    });
    setContinueEnabled(true);
  }

  return true;
}

function requireGenre() {
  const tone = (ELEMENTS.toneEl?.value ?? "").trim();
  if (tone) return tone;

  showAlertPill(GENRE_REQUIRED_MESSAGE);
  ELEMENTS.toneEl?.focus();
  return null;
}

async function runStoryRequest({ isContinuation, isRegeneration = false }) {
  const seed = (ELEMENTS.seedEl?.value ?? "").trim();
  const length = ELEMENTS.lengthEl?.value ?? "short";
  const continuationPrompt =
    (ELEMENTS.continuePromptEl?.value ?? "").trim() || "Continue the story.";

  setLoading(true, {
    btn: ELEMENTS.btn,
    regenBtn: ELEMENTS.regenBtn,
    continueBtn: ELEMENTS.continueBtn,
  });

  const tone = requireGenre();
  if (!tone) {
    setLoading(false, {
      btn: ELEMENTS.btn,
      regenBtn: ELEMENTS.regenBtn,
      continueBtn: ELEMENTS.continueBtn,
    });
    setContinueEnabled(hasActiveConversation());
    return;
  }

  if (isContinuation) {
    if (!hasActiveConversation()) {
      renderError("Create a story first.", ELEMENTS.out);
      setLoading(false, {
        btn: ELEMENTS.btn,
        regenBtn: ELEMENTS.regenBtn,
        continueBtn: ELEMENTS.continueBtn,
      });
      return;
    }

    messages.push({
      role: "user",
      content: `${continuationPrompt} Continue only from the final moment; do not repeat earlier text.`,
    });
  } else {
    if (!seed) {
      renderError("Put a seed.", ELEMENTS.out);
      setLoading(false, {
        btn: ELEMENTS.btn,
        regenBtn: ELEMENTS.regenBtn,
        continueBtn: ELEMENTS.continueBtn,
      });
      return;
    }

    messages = [{ role: "user", content: seed }];
    setContinueEnabled(false);
  }

  renderGenerating(ELEMENTS.out);
  persistSession();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const streamUi = {
    outputEl: ELEMENTS.out,
    copyBtn: ELEMENTS.copyBtn,
    statsEl: ELEMENTS.stats,
    updateStats: (value) => updateStats(value, ELEMENTS.stats),
  };

  async function useLocalFallback(message) {
    renderStory("", { ...streamUi, animate: false });
    showAlertPill(message);

    const storySeed = seed || messages[0]?.content || "the story";
    const newPart = stripCorpusCitations(
      isContinuation
        ? generateLocalContinuation(getStoryText(), continuationPrompt, tone, length)
        : generateLocalStory(storySeed, tone, length)
    );
    messages.push({ role: "assistant", content: newPart });
    appendStoryChunk(newPart, streamUi);
    await completeStoryStream(newPart, streamUi);
    const fullStory = getStoryText();
    if (fullStory !== newPart) {
      renderStory(fullStory, { ...streamUi, animate: false });
    }
    const savedEntry = isContinuation || isRegeneration
      ? saveStoryVersion(fullStory, {
          parentId: historyRootId,
          label: isContinuation ? "Continue story" : "Regenerate story",
        })
      : saveStoryVersion(fullStory, { label: seed });
    if (savedEntry && !historyRootId) historyRootId = savedEntry.id;
    persistSession();
    refreshHistory();
    setContinueEnabled(hasActiveConversation());
  }

  try {
    let streamed = "";
    const { res, data, text, validation } = await streamStory(
      { messages: compactStoryMessages(messages), tone, length, sessionId },
      {
        signal: controller.signal,
        onToken: (chunk) => {
          streamed += chunk;
          appendStoryChunk(streamed, streamUi);
        },
        onDiagnostic: (diagnostic) => streamScope?.recordDiagnostic(diagnostic),
      }
    );
    clearTimeout(timeoutId);

    const story = stripCorpusCitations(String(text || streamed).trim());

    if (!res.ok || !story || !validation.valid) {
      if (res.status === 400 && data?.error) {
        if (isContinuation) messages.pop();
        const message = getValidationMessage(data.error, isContinuation);
        renderStory(getStoryText(), { ...streamUi, animate: false });
        showAlertPill(message);
        persistSession();
        return;
      }
      const { code } = normalizeApiError(res.status, data ?? {});
      await useLocalFallback(FALLBACK_MESSAGE[code] ?? FALLBACK_MESSAGE.HTTP);
      return;
    }

    messages.push({ role: "assistant", content: story });
    if (isContinuation && ELEMENTS.continuePromptEl) {
      ELEMENTS.continuePromptEl.value = "";
    }
    await completeStoryStream(story, streamUi);
    const fullStory = getStoryText();
    if (fullStory !== story) {
      renderStory(fullStory, { ...streamUi, animate: false });
    }
    const savedEntry = isContinuation || isRegeneration
      ? saveStoryVersion(fullStory, {
          parentId: historyRootId,
          label: isContinuation ? "Continue story" : "Regenerate story",
        })
      : saveStoryVersion(fullStory, { label: seed });
    if (savedEntry && !historyRootId) historyRootId = savedEntry.id;
    persistSession();
    refreshHistory();
    setContinueEnabled(hasActiveConversation());
  } catch {
    clearTimeout(timeoutId);
    await useLocalFallback("Using local generator");
  } finally {
    setLoading(false, {
      btn: ELEMENTS.btn,
      regenBtn: ELEMENTS.regenBtn,
      continueBtn: ELEMENTS.continueBtn,
    });
    setContinueEnabled(hasActiveConversation());
  }
}

async function createStory() {
  historyRootId = null;
  await runStoryRequest({ isContinuation: false });
}

async function regenerateStory() {
  await runStoryRequest({ isContinuation: false, isRegeneration: true });
}

async function continueStory() {
  await runStoryRequest({ isContinuation: true });
}

async function copyStory() {
  const text = ELEMENTS.out?.innerText?.trim();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    ELEMENTS.copyBtn.textContent = "Copied!";
    setTimeout(() => {
      ELEMENTS.copyBtn.textContent = "Copy story";
    }, 2000);
  } catch {
    alert("Failed to copy");
  }
}

function onSelectStory(story) {
  const clean = stripCorpusCitations(story);
  const seed = (ELEMENTS.seedEl?.value ?? "").trim() || "Restored story";
  messages = [
    { role: "user", content: seed },
    { role: "assistant", content: clean },
  ];
  const selected = getStories().flatMap((entry) => [entry, ...(entry.children ?? [])]).find((entry) => entry.text === story);
  historyRootId = selected ? (findStoryById(selected.id)?.rootId ?? selected.id) : null;
  renderStory(clean, {
    outputEl: ELEMENTS.out,
    copyBtn: ELEMENTS.copyBtn,
    statsEl: ELEMENTS.stats,
    updateStats: (text) => updateStats(text, ELEMENTS.stats),
  });
  setContinueEnabled(true);
  persistSession();
}

function setLengthDropdownOpen(isOpen) {
  ELEMENTS.lengthDropdown?.classList.toggle("is-open", isOpen);
  ELEMENTS.lengthToggle?.setAttribute("aria-expanded", String(isOpen));
}

function selectLengthOption(optionButton) {
  const value = optionButton.dataset.value;
  if (!value || !ELEMENTS.lengthEl || !ELEMENTS.lengthValue || !ELEMENTS.lengthOptions) return;

  ELEMENTS.lengthEl.value = value;
  ELEMENTS.lengthValue.textContent = optionButton.textContent;

  ELEMENTS.lengthOptions.querySelectorAll("[role='option']").forEach((option) => {
    option.setAttribute(
      "aria-selected",
      String(option.contains(optionButton))
    );
  });

  setLengthDropdownOpen(false);
  persistSession();
}

function init() {
  initDarkMode(ELEMENTS.themeToggle);
  const restored = restoreSession();
  if (!restored) {
    generateRandomSeed();
    persistSession();
  }
  refreshHistory();
  if (!hasActiveConversation()) {
    setContinueEnabled(false);
  }
}

function bindEvents() {
  if (
    ELEMENTS.streamscopeToggle &&
    ELEMENTS.streamscopePanel &&
    ELEMENTS.streamscopeStatus &&
    ELEMENTS.streamscopeEventLog
  ) {
    streamScope = initStreamScope({
      toggleButton: ELEMENTS.streamscopeToggle,
      panel: ELEMENTS.streamscopePanel,
      status: ELEMENTS.streamscopeStatus,
      eventLog: ELEMENTS.streamscopeEventLog,
    });
  }
  initHudResize(
    ELEMENTS.out?.parentElement,
    ELEMENTS.outputResizeHandle
  );
  ELEMENTS.btn?.addEventListener("click", createStory);
  ELEMENTS.regenBtn?.addEventListener("click", regenerateStory);
  ELEMENTS.continueBtn?.addEventListener("click", continueStory);
  ELEMENTS.copyBtn?.addEventListener("click", copyStory);
  ELEMENTS.themeToggle?.addEventListener("click", () => toggleDarkMode(ELEMENTS.themeToggle));
  ELEMENTS.lengthToggle?.addEventListener("click", () => {
    const isOpen = ELEMENTS.lengthDropdown?.classList.contains("is-open");
    setLengthDropdownOpen(!isOpen);
  });
  ELEMENTS.lengthOptions?.addEventListener("click", (e) => {
    const optionButton = e.target.closest("button[data-value]");
    if (optionButton) selectLengthOption(optionButton);
  });
  document.addEventListener("click", (e) => {
    if (!ELEMENTS.lengthDropdown?.contains(e.target)) {
      setLengthDropdownOpen(false);
    }
    if (!ELEMENTS.historyMenu?.contains(e.target)) {
      setHistoryMenuOpen(false);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setLengthDropdownOpen(false);
      setHistoryMenuOpen(false);
    }
  });

  ELEMENTS.historyToggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    ELEMENTS.historyBox?.classList.toggle("expanded");
    const isExpanded = ELEMENTS.historyBox?.classList.contains("expanded");
    const label = isExpanded ? "Collapse history" : "Expand history";
    ELEMENTS.historyToggleBtn?.setAttribute("aria-expanded", String(isExpanded));
    ELEMENTS.historyToggleBtn?.setAttribute("aria-label", label);
    ELEMENTS.historyToggleBtn?.setAttribute("title", label);
    if (isExpanded) {
      expandHistoryEntrance(ELEMENTS.historyEl);
    }
  });

  ELEMENTS.historyMenuToggle?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = ELEMENTS.historyMenu?.classList.contains("is-open");
    setHistoryMenuOpen(!isOpen);
  });

  ELEMENTS.historyFilterFavorites?.addEventListener("click", (e) => {
    e.preventDefault();
    favoritesOnly = !favoritesOnly;
    setHistoryMenuOpen(false);
    refreshHistory();
  });

  ELEMENTS.historyDeleteMenu?.addEventListener("click", async (e) => {
    e.preventDefault();
    setHistoryMenuOpen(false);
    if (ELEMENTS.historyDeleteMenu?.disabled) return;

    const action = await showDeleteHistoryModal();
    if (action === "all") {
      clearStories();
      favoritesOnly = false;
    } else if (action === "unfavorited") {
      clearNonFavorites();
    } else {
      return;
    }
    refreshHistory();
  });

  handleHistoryClick(ELEMENTS.historyEl, onSelectStory);

  bindHistoryActions(ELEMENTS.historyEl, {
    onDeleteAt: async (id) => {
      await deleteHistoryItemAnimated(ELEMENTS.historyEl, id, { favoritesOnly });
      syncHistoryMenu();
    },
    onToggleFavorite: async (id) => {
      await toggleFavoriteAnimated(ELEMENTS.historyEl, id, { favoritesOnly });
      syncHistoryMenu();
    },
  });

  ELEMENTS.seedEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createStory();
  });
  ELEMENTS.toneEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createStory();
  });
  ELEMENTS.seedEl?.addEventListener("change", persistSession);
  ELEMENTS.toneEl?.addEventListener("change", persistSession);
  ELEMENTS.continuePromptEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && hasActiveConversation()) continueStory();
  });
}

whenReady(() => {
  init();
  bindEvents();
});
