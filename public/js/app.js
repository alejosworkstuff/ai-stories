import { whenReady } from "./utils.js";
import { RANDOM_SEEDS } from "./constants.js";
import { getStories, saveStory } from "./storage.js";
import { requestStory } from "./api.js";
import { normalizeApiError } from "./http.js";
import { generateLocalStory } from "./localGenerator.js";
import { initDarkMode, toggleDarkMode } from "./theme.js";
import {
  loadHistory,
  handleHistoryClick,
  renderStory,
  renderError,
  renderGenerating,
  updateStats,
  showFallbackModal,
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
  themeToggle: document.getElementById("themeToggle"),
};

let messages = [];
let fallbackPopupShown = false;

const FALLBACK_MESSAGE = {
  CREDITS: "Out of credits - generating fallback story",
  RATE_LIMIT: "Too many requests - using local generator",
  VALIDATION: "Invalid request - using local generator",
  SERVER: "AI service error - using local generator",
  HTTP: "AI unavailable - using local generator",
};

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

function renderCurrentStory() {
  const story = getStoryText();
  renderStory(story, {
    outputEl: ELEMENTS.out,
    copyBtn: ELEMENTS.copyBtn,
    statsEl: ELEMENTS.stats,
    updateStats: (text) => updateStats(text, ELEMENTS.stats),
  });
  saveStory(story);
  loadHistory(ELEMENTS.historyEl);
  setContinueEnabled(hasActiveConversation());
}

async function runStoryRequest({ isContinuation }) {
  const seed = (ELEMENTS.seedEl?.value ?? "").trim();
  const tone = (ELEMENTS.toneEl?.value ?? "").trim();
  const length = ELEMENTS.lengthEl?.value ?? "short";

  setLoading(true, {
    btn: ELEMENTS.btn,
    regenBtn: ELEMENTS.regenBtn,
    continueBtn: ELEMENTS.continueBtn,
  });

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

    const prompt =
      (ELEMENTS.continuePromptEl?.value ?? "").trim() || "Continue the story.";
    messages.push({ role: "user", content: prompt });
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  function useLocalFallback(message) {
    if (!fallbackPopupShown) {
      fallbackPopupShown = true;
      showFallbackModal(message);
    }

    const storySeed = seed || messages[0]?.content || "the story";
    const newPart = generateLocalStory(storySeed, tone, length);
    messages.push({ role: "assistant", content: newPart });
    renderCurrentStory();
  }

  try {
    const res = await requestStory({ messages, tone, length }, controller.signal);
    clearTimeout(timeoutId);

    const contentType = res.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    const story = String(data?.output ?? "");

    if (!res.ok || !story.trim()) {
      const { code } = normalizeApiError(res.status, data ?? {});
      useLocalFallback(FALLBACK_MESSAGE[code] ?? FALLBACK_MESSAGE.HTTP);
      return;
    }

    messages.push({ role: "assistant", content: story });
    if (isContinuation && ELEMENTS.continuePromptEl) {
      ELEMENTS.continuePromptEl.value = "";
    }
    renderCurrentStory();
  } catch {
    clearTimeout(timeoutId);
    useLocalFallback("Using local generator");
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
  await runStoryRequest({ isContinuation: false });
}

async function regenerateStory() {
  await runStoryRequest({ isContinuation: false });
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
  const seed = (ELEMENTS.seedEl?.value ?? "").trim() || "Restored story";
  messages = [
    { role: "user", content: seed },
    { role: "assistant", content: story },
  ];
  renderStory(story, {
    outputEl: ELEMENTS.out,
    copyBtn: ELEMENTS.copyBtn,
    statsEl: ELEMENTS.stats,
    updateStats: (text) => updateStats(text, ELEMENTS.stats),
  });
  setContinueEnabled(true);
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
}

function init() {
  initDarkMode(ELEMENTS.themeToggle);
  generateRandomSeed();
  loadHistory(ELEMENTS.historyEl);
  setContinueEnabled(false);
}

function bindEvents() {
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
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setLengthDropdownOpen(false);
  });

  ELEMENTS.historyToggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    ELEMENTS.historyBox?.classList.toggle("expanded");
    const isExpanded = ELEMENTS.historyBox?.classList.contains("expanded");
    ELEMENTS.historyToggleBtn?.setAttribute("aria-expanded", String(isExpanded));
    ELEMENTS.historyToggleBtn?.setAttribute(
      "aria-label",
      isExpanded ? "Collapse history" : "Expand history"
    );
  });

  handleHistoryClick(ELEMENTS.historyEl, onSelectStory);

  ELEMENTS.seedEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createStory();
  });
  ELEMENTS.toneEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") createStory();
  });
  ELEMENTS.continuePromptEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && hasActiveConversation()) continueStory();
  });
}

whenReady(() => {
  init();
  bindEvents();
});
