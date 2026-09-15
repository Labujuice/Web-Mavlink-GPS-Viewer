/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          black: '#000000',
          dark: '#0a0d0a',
          card: '#0f140f',
          border: '#1a3320',
          line: '#00ff66',
          dim: '#15803d',
          glow: 'rgba(0, 255, 102, 0.15)',
          text: '#00ff66',
          muted: '#4ade80',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Roboto Mono', 'Consolas', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
