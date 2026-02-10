const btn = document.getElementById("btn");
const seedEl = document.getElementById("seed");
const toneEl = document.getElementById("tone");
const lengthEl = document.getElementById("length");
const out = document.getElementById("output");

btn.addEventListener("click", async () => {
  const seed = seedEl.value.trim();
  const tone = toneEl.value.trim(); // optional
  const length = lengthEl.value;

  if (!seed) {
    renderError("Put a seed.");
    return;
  }

  setLoading(true);

  try {
    const res = await fetch("/api/generate-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, tone, length }),
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
        renderError(
          "The AI service has no available credits right now. " +
            "This is expected if you're running the project without your own API token."
        );
      } else {
        const message =
          data?.error ||
          (typeof data === "string" ? data : null) ||
          `Request failed (${res.status}). Please try again.`;
        renderError(message);
      }
      return;
    }

    renderStory(data?.output ?? "");

  } catch (err) {
    renderError(err.message);
  } finally {
    setLoading(false);
  }
});

/* =====================
   Helpers
===================== */

function renderError(message) {
  out.innerHTML = `<p style="color:#b00">${escapeHtml(message)}</p>`;
}

function renderStory(output) {
  const text = Array.isArray(output) ? output.join("\n\n") : output;
  out.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
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
