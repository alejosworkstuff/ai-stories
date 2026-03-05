let messages = [];
const btn = document.getElementById("btn");
const seedEl = document.getElementById("seed");
const toneEl = document.getElementById("tone");
const lengthEl = document.getElementById("length");
const out = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");
const stats = document.getElementById("stats");
const regenBtn = document.getElementById("regenBtn");
const randomSeeds = [
  "A time traveler stuck in ancient Rome",
  "A detective who can hear lies",
  "An astronaut waking up on the wrong planet",
  "A violinist in Buenos Aires who discovers a secret code",
  "A medieval knight fighting a machine uprising",
  "A fisherman who catches a message from the future",
  "A programmer who accidentally deletes reality",
  "A ghost trapped inside a smartphone"
];

async function requestStory(payload) {
  const res = await fetch("/api/generate-story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return res;
}

async function generateStory() {
  const seed = seedEl.value.trim();
  const tone = toneEl.value.trim();
  const length = lengthEl.value;

  if (!seed) {
    renderError("Put a seed.");
    return;
  }

  messages.push({
    role: "user",
    content: seed
  });

  setLoading(true);

  try {
    const res = await fetch("/api/generate-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, tone, length }),
    });

    const contentType = res.headers.get("content-type") || "";
    let data = null;

    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      if (res.status === 402) {
        renderError("The AI service has no available credits right now.");
      } else {
        const message =
          data?.error ||
          (typeof data === "string" ? data : null) ||
          `Request failed (${res.status}). Please try again.`;

        renderError(message);
      }
      return;
    }

    const story = data?.output ?? "";
    messages.push({
      role: "assistant",
      content: story
    });

    renderStory(story);

  } catch (err) {
    renderError(err?.message || "Unexpected error.");
  } finally {
    setLoading(false);
  }
}

async function copyStory() {
  const text = out.innerText.trim();

  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied!";

    setTimeout(() => {
      copyBtn.textContent = "Copy story";
    }, 2000);

  } catch {
    alert("Failed to copy");
  }
}

btn?.addEventListener("click", generateStory);

regenBtn?.addEventListener("click", () => {
  generateStory();
});

copyBtn?.addEventListener("click", copyStory);

seedEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    generateStory();
  }
});

toneEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    generateStory();
  }
});


/* =====================
   Helpers
===================== */

function generateRandomSeed() {
  const randomIndex = Math.floor(Math.random() * randomSeeds.length);
  const random = randomSeeds[randomIndex];
  seedEl.value = random;
}

function updateStats(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  stats.innerHTML = `Words: ${words} | Characters: ${chars}`;
}

function renderError(message) {
  out.innerHTML = `<p style="color:#b00">${escapeHtml(message)}</p>`;
}

function renderStory(output) {
  const text = Array.isArray(output) ? output.join("\n\n") : output;
  out.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
  updateStats(text);
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Generating..." : "Create";
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

generateRandomSeed();