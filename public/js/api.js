export async function requestStory(payload, signal) {
  return fetch("/api/generate-stories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}
