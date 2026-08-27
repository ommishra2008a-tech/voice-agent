/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0a0603",
        foreground: "#fdf3ec",
        card: "#150d08",
        border: "#3a2214",
        accent: "#ff6b1a",
      },
    },
  },
  plugins: [],
};
