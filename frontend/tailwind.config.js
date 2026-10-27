/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        //these colours are for the sidebar and dark surfaces
        ink: {
          950: '#121316',
          900: '#18191d',
          800: '#24262b',
          700: '#30333a',
          500: '#8a8e98',
          300: '#c7cad1',
        },
        //these colours are for the page background and hairlines
        paper: '#f6f5f1',
        line: '#e6e4de',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
