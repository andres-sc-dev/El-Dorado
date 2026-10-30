/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0A1628',
          navyAlt: '#0B1C2E',
          gold: '#F5B942',
          goldDeep: '#E8A317',
          panel: '#11243b',
          card: '#12273d',
          input: '#091a2b',
          muted: '#88A0B8',
          cyan: '#6EE7F9',
        },
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.28)',
      },
      backgroundImage: {
        hero: "linear-gradient(110deg, rgba(10, 22, 40, 0.82), rgba(10, 22, 40, 0.5)), url('https://images.unsplash.com/photo-1547347298-4074fc3086f0?auto=format&fit=crop&w=1200&q=80')",
      },
    },
  },
  plugins: [],
}

