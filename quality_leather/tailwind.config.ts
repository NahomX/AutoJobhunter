import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        leather: {
          50: '#fdf8f0',
          100: '#f9edd9',
          200: '#f1d5ae',
          300: '#e6b57a',
          400: '#d98e47',
          500: '#cc7a30',
          600: '#b86025',
          700: '#994b21',
          800: '#7c3e22',
          900: '#65341f',
        },
      },
    },
  },
  plugins: [],
}

export default config
