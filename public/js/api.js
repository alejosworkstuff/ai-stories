import { fetchWithResilience } from "./http.js";

export async function requestStory(payload, signal) {
  return fetchWithResilience("/api/generate-stories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
}
