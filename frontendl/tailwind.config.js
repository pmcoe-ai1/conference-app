/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#293042',
          850: '#1a1f2e'
        }
      }
    }
  },
  plugins: []
};
