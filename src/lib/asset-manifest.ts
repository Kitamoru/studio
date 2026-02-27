/**
 * Asset Manifest: Геометрические параметры и точки привязки
 */
export const ASSET_MANIFEST = {
  PLAYER: {
    width: 72,
    height: 72,
    hitboxPadding: 16,
    anchor: { x: 0.5, y: 1.0 }
  },
  MONSTERS: {
    SLIME: { width: 40, height: 30, color: '#4ADE80', type: 'GROUND' },
    MIMIC: { width: 48, height: 48, color: '#78350F', type: 'GROUND' },
    BEHOLDER: { width: 52, height: 52, color: '#9F1239', type: 'AIR_LOW' },
    BAT: { width: 32, height: 32, color: '#4B5563', type: 'AIR_HIGH' },
    DRAGON: { width: 100, height: 80, color: '#B91C1C', type: 'TALL' }
  },
  PARALLAX: {
    BACK: { speed: 0.1, color: '#1A1621' },
    MID: { speed: 0.4, color: '#25202D' },
    FRONT: { speed: 1.0, color: '#2A2433' }
  }
};
