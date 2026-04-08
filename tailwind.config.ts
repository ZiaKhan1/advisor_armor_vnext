import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef8ff',
          100: '#d7ecff',
          500: '#0b5fff',
          700: '#0a3f93',
          900: '#0b2246'
        },
        success: '#008756',
        warning: '#d18b00',
        danger: '#b42318'
      },
      boxShadow: {
        panel: '0 18px 50px rgba(11, 34, 70, 0.08)'
      }
    }
  },
  plugins: []
} satisfies Config
