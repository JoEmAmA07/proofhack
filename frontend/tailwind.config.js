/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#070b12',
          surface: '#0d1522',
          card: '#131e30',
          border: '#1e2e46',
          teal: '#14b8a6',
          cyan: '#06b6d4',
          accent: '#22d3ee',
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.35)',
        'glow-teal': '0 0 25px -5px rgba(20, 184, 166, 0.35)',
      }
    },
  },
  plugins: [],
}

