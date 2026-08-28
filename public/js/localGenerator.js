function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * @param {string} seed
 * @param {string} tone
 * @param {string} length
 * @returns {string}
 */
export function generateLocalStory(seed, tone, length) {
  const intros = [
    `It began with ${seed}.`,
    `Everything started when ${seed}.`,
    `No one expected that ${seed}.`,
    `The story truly begins when ${seed}.`,
  ];

  const conflicts = [
    "Soon, something went terribly wrong.",
    "But the situation quickly became dangerous.",
    "What seemed simple soon turned into chaos.",
    "Then an unexpected problem appeared.",
  ];

  const twists = [
    "A hidden truth slowly revealed itself.",
    "Someone was not who they claimed to be.",
    "Reality was not what it seemed.",
    "A secret changed everything.",
  ];

  const endings = [
    "In the end, nothing would ever be the same.",
    "From that day forward, the world felt different.",
    "The experience left a permanent mark.",
    "And that is how the legend was born.",
  ];

  const paragraphs = [pick(intros)];

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

export function generateLocalContinuation(previousStory, prompt, tone, length) {
  const latestScene = previousStory.trim().slice(-420);
  const direction = prompt.trim() || "the next moment";
  const paragraphs = [
    `The next scene began after ${latestScene || "the last quiet moment"}.`,
    `Following ${direction}, the characters moved before the chance could disappear.`,
  ];

  if (length === "medium" || length === "long") {
    paragraphs.push("Each new clue made the path more dangerous, but turning back was no longer possible.");
  }
  if (length === "long") {
    paragraphs.push("Far ahead, an unexpected choice waited in the dark.");
  }
  if (tone === "dark") paragraphs.push("A quiet sense of dread followed every step.");
  if (tone === "funny") paragraphs.push("Somehow, the plan was still more ridiculous than anyone expected.");
  if (tone === "epic") paragraphs.push("The moment would later be remembered as the beginning of a greater legend.");

  return paragraphs.join("\n\n");
}
