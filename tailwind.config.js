/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./public/index.html", "./public/js/**/*.js"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      animation: {
        pulseHint: "pulseHint 1.2s ease-in-out infinite",
        fadeIn: "fadeIn 0.2s ease-out",
        fadeOut: "fadeOut 0.25s ease-in forwards",
        slideIn: "slideIn 0.25s ease-out",
        toastShake: "toastShake 0.45s ease-in-out",
        lavaBreathe: "lavaBreathe 2.6s ease-in-out infinite",
        lavaSwirl: "lavaSwirl 2.9s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite",
      },
      keyframes: {
        pulseHint: {
          "0%, 100%": { opacity: "0.45" },
          "50%": { opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        fadeOut: {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        slideIn: {
          from: { opacity: "0", transform: "translateY(-20px) scale(0.95)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        toastShake: {
          "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
          "20%": { transform: "translateX(calc(-50% - 6px)) translateY(0)" },
          "40%": { transform: "translateX(calc(-50% + 6px)) translateY(0)" },
          "60%": { transform: "translateX(calc(-50% - 4px)) translateY(0)" },
          "80%": { transform: "translateX(calc(-50% + 4px)) translateY(0)" },
        },
        lavaBreathe: {
          "0%, 100%": { transform: "translateY(0) scale(1.01)", filter: "blur(2px) saturate(125%)" },
          "50%": { transform: "translateY(-1px) scale(1.07)", filter: "blur(3px) saturate(145%)" },
        },
        lavaSwirl: {
          "0%": { transform: "translateY(0) rotate(0deg) scale(1.06)" },
          "50%": { transform: "translateY(-2px) rotate(180deg) scale(1.12)" },
          "100%": { transform: "translateY(0) rotate(360deg) scale(1.06)" },
        },
      },
    },
  },
  plugins: [],
};
