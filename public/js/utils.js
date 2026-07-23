export function whenReady(fn) {
  if (document.readyState !== "loading") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

/** Remove leaked RAG source tags like `[narrative-structure.md]` from story prose. */
export function stripCorpusCitations(text) {
  return String(text ?? "")
    .replace(/\s*\[[^\]]+\.md\]/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trimEnd();
}

export function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
