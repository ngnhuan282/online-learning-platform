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
export const frameArt = {
  'kitty-scholar': frameAssets.FRAME_KITTY,
  'koala-garden': frameAssets.FRAME_KOALA,
  'owl-wizard': frameAssets.FRAME_OWL,
  'bunny-bloom': frameAssets.FRAME_BUNNY,
};
const backgroundArt = {
  'campus-sunrise': backgroundAssets.BACKGROUND_CAMPUS,
  'moonlit-library': backgroundAssets.BACKGROUND_LIBRARY,
};
export function appearanceBackground(code, assetKey) {
  const image = backgroundArt[assetKey] || backgroundAssets[code];
  return image
    ? { backgroundImage: `url(${image})` }
    : {
        backgroundImage:
          'radial-gradient(circle at 85% 20%, #ffeec7 0, transparent 35%), linear-gradient(135deg, #e1f5ff, #eee4ff)',
      };
}
