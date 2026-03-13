import { whenReady } from "./utils.js";
import { RANDOM_SEEDS } from "./constants.js";
import { getStories, saveStory } from "./storage.js";
import { requestStory } from "./api.js";
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

function generateRandomSeed() {
  const randomIndex = Math.floor(Math.random() * RANDOM_SEEDS.length);
  if (ELEMENTS.seedEl) ELEMENTS.seedEl.value = RANDOM_SEEDS[randomIndex];
}

async function generateStory() {
  const seed = (ELEMENTS.seedEl?.value ?? "").trim();
  const tone = (ELEMENTS.toneEl?.value ?? "").trim();
  const length = ELEMENTS.lengthEl?.value ?? "short";

  setLoading(true, { btn: ELEMENTS.btn, regenBtn: ELEMENTS.regenBtn });

  if (!seed) {
    renderError("Put a seed.", ELEMENTS.out);
    setLoading(false, { btn: ELEMENTS.btn, regenBtn: ELEMENTS.regenBtn });
    return;
  }

  messages = [{ role: "user", content: seed }];
  renderGenerating(ELEMENTS.out);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  function useLocalFallback(message) {
    if (!fallbackPopupShown) {
      fallbackPopupShown = true;
      showFallbackModal(message);
    }
    const story = generateLocalStory(seed, tone, length);
    renderStory(story, {
      outputEl: ELEMENTS.out,
      copyBtn: ELEMENTS.copyBtn,
      statsEl: ELEMENTS.stats,
      updateStats: (text) => updateStats(text, ELEMENTS.stats),
    });
    saveStory(story);
    loadHistory(ELEMENTS.historyEl);
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
    const isOutOfCredits = res.status === 402;

    if (!res.ok || !story.trim()) {
      useLocalFallback(
        isOutOfCredits
          ? "Out of credits - generating fallback story"
          : "AI unavailable - using local generator"
      );
      return;
    }

    messages.push({ role: "assistant", content: story });
    renderStory(story, {
      outputEl: ELEMENTS.out,
      copyBtn: ELEMENTS.copyBtn,
      statsEl: ELEMENTS.stats,
      updateStats: (text) => updateStats(text, ELEMENTS.stats),
    });
    saveStory(story);
    loadHistory(ELEMENTS.historyEl);
  } catch {
    clearTimeout(timeoutId);
    useLocalFallback("Using local generator");
  } finally {
    setLoading(false, { btn: ELEMENTS.btn, regenBtn: ELEMENTS.regenBtn });
  }
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
  renderStory(story, {
    outputEl: ELEMENTS.out,
    copyBtn: ELEMENTS.copyBtn,
    statsEl: ELEMENTS.stats,
    updateStats: (text) => updateStats(text, ELEMENTS.stats),
  });
}

function init() {
  initDarkMode(ELEMENTS.themeToggle);
  generateRandomSeed();
  loadHistory(ELEMENTS.historyEl);
}

function bindEvents() {
  ELEMENTS.btn?.addEventListener("click", generateStory);
  ELEMENTS.regenBtn?.addEventListener("click", generateStory);
  ELEMENTS.copyBtn?.addEventListener("click", copyStory);
  ELEMENTS.themeToggle?.addEventListener("click", () => toggleDarkMode(ELEMENTS.themeToggle));

  ELEMENTS.historyToggleBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    ELEMENTS.historyBox?.classList.toggle("expanded");
    if (ELEMENTS.historyToggleBtn) {
      ELEMENTS.historyToggleBtn.textContent = ELEMENTS.historyBox?.classList.contains("expanded")
        ? "« Collapse"
        : "»";
    }
  });

  handleHistoryClick(ELEMENTS.historyEl, onSelectStory);

  ELEMENTS.seedEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") generateStory();
  });
  ELEMENTS.toneEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") generateStory();
  });
}

whenReady(() => {
  init();
  bindEvents();
});
