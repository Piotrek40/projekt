/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1a1a1a',
        'dark-surface': '#2d2d2d',
        'dark-border': '#404040',
        'accent': '#8b5cf6',
        'accent-hover': '#7c3aed',
      }
    },
  },
  plugins: [],
}
