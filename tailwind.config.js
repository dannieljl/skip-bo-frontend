/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'skipbo-blue': '#1e3a8a',
        'skipbo-green': '#15803d',
        'skipbo-red': '#be123c',
        'skipbo-orange': '#f59e0b',
      }
    },
  },
  plugins: [],
}
