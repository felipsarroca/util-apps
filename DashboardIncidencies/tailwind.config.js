/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"', '"Segoe UI Symbol"', '"Noto Color Emoji"'],
      },
      fontSize: {
        'base': '1.1rem',
      },
      colors: {
        'background': '#fffaf0', // Very light ocher (orange-50)
        'surface': '#ffffff', // white
        'text-primary': '#334155', // slate-700
        'text-secondary': '#64748b', // slate-500
        'border-color': '#e2e8f0', // slate-200
        'brand-primary': '#2563eb', // blue-600
        'brand-secondary': '#f97316', // orange-500
        'brand-tertiary': '#10b981', // emerald-500
        'brand-red': '#ef4444', // red-500
        'brand-amber': '#f59e0b', // amber-500
      },
    },
  },
  plugins: [],
}
