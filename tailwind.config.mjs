/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        seashell:   '#FAF1EC',
        darkWalnut: '#642713',
        cayenne:    '#F35A0F',
        amber:      '#FFBC29',
        celadon:    '#90D393',
        mayaBlue:   '#5BC3FF',
        babyPink:   '#F79CD0',
      },
      fontFamily: {
        heading: ['"JT Modernism"', 'Georgia', 'serif'],
        body:    ['Montserrat', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        retro:           '4px 4px 0px #642713',
        'retro-amber':   '4px 4px 0px #FFBC29',
        'retro-cayenne': '4px 4px 0px #F35A0F',
      },
    },
  },
  plugins: [],
};
