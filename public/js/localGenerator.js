function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
