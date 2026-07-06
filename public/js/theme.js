import { STORAGE_KEYS } from "./constants.js";

export function initDarkMode(themeToggle) {
  const isDark = localStorage.getItem(STORAGE_KEYS.darkMode) === "true";
  document.documentElement.classList.toggle("dark", isDark);
  if (themeToggle) {
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }
}

export function toggleDarkMode(themeToggle) {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(STORAGE_KEYS.darkMode, isDark);
  if (themeToggle) {
    themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  }
}
