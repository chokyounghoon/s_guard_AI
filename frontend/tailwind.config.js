/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'xs': ['clamp(0.6rem, 1.5vw, 0.75rem)', { lineHeight: '1rem' }],
        'sm': ['clamp(0.7rem, 2vw, 0.875rem)', { lineHeight: '1.25rem' }],
        'base': ['clamp(0.8rem, 2vw, 1rem)', { lineHeight: '1.5rem' }],
        'lg': ['clamp(0.9rem, 2.5vw, 1.125rem)', { lineHeight: '1.75rem' }],
        'xl': ['clamp(1rem, 3.5vw, 1.25rem)', { lineHeight: '1.75rem' }],
        '2xl': ['clamp(1.1rem, 4.5vw, 1.5rem)', { lineHeight: '2rem' }],
        '3xl': ['clamp(1.125rem, 5vw, 1.875rem)', { lineHeight: '2.25rem' }],
        '4xl': ['clamp(1.35rem, 6vw, 2.25rem)', { lineHeight: '2.5rem' }],
        '5xl': ['clamp(1.75rem, 8vw, 3rem)', { lineHeight: '1' }],
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      }
    },
  },
  plugins: [],
}
