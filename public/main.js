let messages = [];

const btn = document.getElementById("btn");
const seedEl = document.getElementById("seed");
const toneEl = document.getElementById("tone");
const lengthEl = document.getElementById("length");
const out = document.getElementById("output");
const copyBtn = document.getElementById("copyBtn");
const stats = document.getElementById("stats");
const regenBtn = document.getElementById("regenBtn");
const historyEl = document.getElementById("history");


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



function loadHistory() {
  if (!historyEl) return;

  let saved = [];

  try {
    saved = JSON.parse(localStorage.getItem("storyHistory")) || [];
  } catch {
    saved = [];
  }

  historyEl.innerHTML = "";

  saved.forEach((story) => {
    const safeStory = String(story);

    const li = document.createElement("li");

    li.textContent =
      safeStory.length > 60
        ? safeStory.slice(0, 60) + "..."
        : safeStory;

    li.addEventListener("click", () => {
      renderStory(safeStory);
    });

    historyEl.appendChild(li);
  });
}

function saveStory(story) {
  let saved = [];

  try {
    saved = JSON.parse(localStorage.getItem("storyHistory")) || [];
  } catch {
    saved = [];
  }

  saved.unshift(String(story));

  if (saved.length > 20) {
    saved.pop();
  }

  localStorage.setItem("storyHistory", JSON.stringify(saved));
}


async function requestStory(payload) {
  return fetch("/api/generate-story", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}



async function generateStory() {
  const seed = seedEl.value.trim();
  const tone = toneEl.value.trim();
  const length = lengthEl.value;

  setLoading(true);

  if (!seed) {
    renderError("Put a seed.");
    setLoading(false);
    return;
  }

  messages = [
    {
      role: "user",
      content: seed
    }
  ];

  
  out.innerHTML = "<p class='hint'>Generating story...</p>";

  try {
    const res = await requestStory({ messages, tone, length });

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

      const story = generateLocalStory(seed, tone, length);

        out.innerHTML = "<p class='hint'>AI unavailable — using local generator</p>";

        renderStory(story);
        saveStory(story);
        loadHistory();

      return;
    }

    const story = String(data?.output ?? "");

    messages.push({
      role: "assistant",
      content: story
    });

    renderStory(story);

    saveStory(story);
    loadHistory();

  } catch (err) {
   const story = generateLocalStory(seed, tone, length);

   out.innerHTML = "<p class='hint'>Failed to connect to server — using local generator</p>";
   renderStory(story);
   saveStory(story);
   loadHistory();
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

regenBtn?.addEventListener("click", generateStory);

copyBtn?.addEventListener("click", copyStory);

seedEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generateStory();
});

toneEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") generateStory();
});



function generateRandomSeed() {
  const randomIndex = Math.floor(Math.random() * randomSeeds.length);
  seedEl.value = randomSeeds[randomIndex];
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

  copyBtn?.style.display = "block";
  
  const text = Array.isArray(output) ? output.join("\n\n") : output;

  out.innerHTML = `<pre>${escapeHtml(text)}</pre>`;

  updateStats(text);
  
  out.scrollIntoView({ behavior: "smooth" });
}

function setLoading(isLoading) {
  btn.disabled = isLoading;
  regenBtn.disabled = isLoading;

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

function generateLocalStory(seed, tone, length) {

const intros = [
   `It began with ${seed}.`,
   `Everything started when ${seed}.`,
   `No one expected that ${seed}.`,
   `The story truly begins when ${seed}.`
];

const conflicts = [
   "Soon, something went terribly wrong.",
   "But the situation quickly became dangerous.",
   "What seemed simple soon turned into chaos.",
   "Then an unexpected problem appeared."
];

const twists = [
   "A hidden truth slowly revealed itself.",
   "Someone was not who they claimed to be.",
   "Reality was not what it seemed.",
   "A secret changed everything."
];

const endings = [
   "In the end, nothing would ever be the same.",
   "From that day forward, the world felt different.",
   "The experience left a permanent mark.",
   "And that is how the legend was born."
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

let paragraphs = [];

paragraphs.push(pick(intros));

if (length === "medium" || length === "long") {
  paragraphs.push(pick(conflicts));
}

if (length === "long") {
  paragraphs.push(pick(twists));
}

paragraphs.push(pick(endings));

if (tone === "dark") {
  paragraphs.push("A quiet sense of dread remained in the air.");
}

if (tone === "funny") {
  paragraphs.push("Looking back, it was all a bit ridiculous.");
}

if (tone === "epic") {
  paragraphs.push("Songs would later be written about this moment.");
}

return paragraphs.join("\n\n");

}


generateRandomSeed();
loadHistory();

