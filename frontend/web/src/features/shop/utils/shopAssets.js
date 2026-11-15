export const frameAssets = {
  FRAME_KITTY: { src: '/images/shop/kitty-scholar.png', y: '64.8%', diameter: '46%' },
  FRAME_KOALA: { src: '/images/shop/koala-garden.png', y: '65.5%', diameter: '53%' },
  FRAME_OWL: { src: '/images/shop/owl-wizard.png', y: '68.7%', diameter: '42.3%' },
  FRAME_BUNNY: { src: '/images/shop/bunny-bloom.png', y: '59.6%', diameter: '49.5%' },
};
export const backgroundAssets = {
  BACKGROUND_CAMPUS: '/images/shop/campus-sunrise.png',
  BACKGROUND_LIBRARY: '/images/shop/moonlit-library.png',
};
export function appearanceBackground(code) {
  return backgroundAssets[code]
    ? { backgroundImage: `url(${backgroundAssets[code]})` }
    : {
        backgroundImage:
          'radial-gradient(circle at 85% 20%, #ffeec7 0, transparent 35%), linear-gradient(135deg, #e1f5ff, #eee4ff)',
      };
}
