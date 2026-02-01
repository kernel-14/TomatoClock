/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pomodoro-red': '#E74C3C',
        'pomodoro-green': '#2ECC71',
        'pomodoro-blue': '#3498DB',
      },
      boxShadow: {
        'float': '0 10px 40px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
