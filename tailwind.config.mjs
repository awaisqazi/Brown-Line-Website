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
        // Montserrat is the typeface for body AND headings (legibility).
        // JT Modernism is reserved EXCLUSIVELY for the brand logo wordmark
        // ("the Brown Line") via `font-wordmark`. See design.md § 3.
        heading:  ['Montserrat', 'system-ui', 'sans-serif'],
        body:     ['Montserrat', 'system-ui', 'sans-serif'],
        // Event preview cards use Arial so dense listing text stays compact
        // and every card renders at the same size.
        card:     ['Arial', 'Helvetica', 'system-ui', 'sans-serif'],
        wordmark: ['"JT Modernism"', 'Georgia', 'serif'],
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
