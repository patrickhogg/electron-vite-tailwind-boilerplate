module.exports = {
  darkMode: 'class', // Enable dark mode through a class toggle
  content: ["./src/**/*.{html,js,vue}"],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#f8fafc',
          100: '#eef1f3',
          200: '#dce0e3',
          300: '#c5cacd',
          400: '#a2a8ac',
          500: '#898f94',
          600: '#6c7277',
          700: '#51565b',
          800: '#2b2f34',
          850: '#1e2226',
          900: '#111418',
          950: '#0a0d10',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ],
}