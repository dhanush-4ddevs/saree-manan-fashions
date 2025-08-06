/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'blue': {
          50: '#f0f7ff',
          100: '#e0eefe',
          200: '#bcd9fe',
          300: '#90befd',
          400: '#5b9afb',
          500: '#3b7ff9',
          600: '#2563eb',
          700: '#1d56d6',
          800: '#1e45af',
          900: '#1e3b8a',
          950: '#172554',
        },
      },
      boxShadow: {
        'blue-sm': '0 1px 2px 0 rgba(37, 99, 235, 0.05)',
        'blue-md': '0 4px 6px -1px rgba(37, 99, 235, 0.1), 0 2px 4px -1px rgba(37, 99, 235, 0.06)',
        'blue-lg': '0 10px 15px -3px rgba(37, 99, 235, 0.1), 0 4px 6px -2px rgba(37, 99, 235, 0.05)',
      },
    },
  },
  plugins: [],
}
