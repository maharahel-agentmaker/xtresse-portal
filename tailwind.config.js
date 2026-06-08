/** Xtressé portal — Tailwind theme mirrors the brand tokens */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        xorange: '#FFC45C',
        xorangeDeep: '#F5A623',
        xorangeSoft: '#FFE2A8',
        xcreme: '#F7F5F0',
        xcremeWarm: '#EFEAE0',
        xmerlot: '#C15757',
        xmerlotDeep: '#8E3C3C',
        xblack: '#191817',
        xblackSoft: '#2A2826',
        xline: '#E1DCD0',
        xlineStrong: '#C8C2B4',
        xmuted: '#6E6A63',
      },
      fontFamily: {
        serif: ['"The Seasons"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Sarvatrik', 'Inter', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
