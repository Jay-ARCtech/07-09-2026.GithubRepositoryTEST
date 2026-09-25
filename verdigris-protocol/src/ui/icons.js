// Small stroke-SVG icon set, built via the safe svg() DOM builder (never
// innerHTML) — mixes cyberpunk (chip, bolt) and solarpunk (leaf, seed)
// iconography on purpose; the fusion is the whole point of the setting.

import { svg } from '../engine/dom.js';

function icon(paths, { size = 16, color = 'currentColor', viewBox = '0 0 24 24', strokeWidth = '2' } = {}) {
  return svg('svg', { width: size, height: size, viewBox, fill: 'none', stroke: color, 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    ...paths.map((d) => svg('path', { d })));
}

export const IconBolt = (opts) => icon(['M13 2 3 14h7l-1 8 10-12h-7l1-8z'], opts);
export const IconLeaf = (opts) => icon(['M12 3c-4 3-6 6-6 10a6 6 0 0 0 12 0c0-4-2-7-6-10z'], opts);
export const IconChip = (opts) => icon(['M7 7h10v10H7z', 'M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3'], opts);
export const IconShield = (opts) => icon(['M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7z'], opts);
export const IconHeart = (opts) => icon(['M12 21s-7-4.6-7-10A5 5 0 0 1 12 6a5 5 0 0 1 7 5c0 5.4-7 10-7 10z'], opts);
export const IconFlame = (opts) => icon(['M12 2c1 4-3 5-3 9a4 4 0 0 0 8 0c0-1.5-1-2.5-1-2.5S17 12 17 15a5 5 0 0 1-10 0c0-6 5-7 5-13z'], opts);
export const IconSeed = (opts) => icon(['M12 3c-4 3-6 6-6 10a6 6 0 0 0 12 0c0-4-2-7-6-10z', 'M12 8v9'], opts);
export const IconArrowOut = (opts) => icon(['M4 12h13M13 6l6 6-6 6'], opts);
export const IconSkull = (opts) => icon(['M12 3a7 7 0 0 0-7 7c0 3 1.6 4.6 2.5 5.6V19h9v-3.4C17.4 14.6 19 13 19 10a7 7 0 0 0-7-7z', 'M9.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM14.5 12a1 1 0 1 0 0-2 1 1 0 0 0 0 2z', 'M10 19v2M14 19v2'], opts);
export const IconBook = (opts) => icon(['M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z', 'M18 19V3'], opts);
export const IconUsers = (opts) => icon(['M8 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3 2.5-5.5 5.5-5.5S14 17 14 20', 'M16 12a3 3 0 1 0 0-6', 'M21 20c0-2.5-1.8-4.6-4-5.2'], opts);
