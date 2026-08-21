/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          500: '#7c3aed',
          700: '#5b21b6',
        },
      },
      boxShadow: {
        soft: '0 20px 45px rgba(15, 23, 42, 0.12)',
      },
    },
  },
  plugins: [],
};
