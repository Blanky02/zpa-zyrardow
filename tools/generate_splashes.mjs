// Generuje ekrany startowe (apple-touch-startup-image) dla iPhone'ow.
// Uzycie:  npm i --no-save sharp   &&   node tools/generate_splashes.mjs
// Wynik:  public/icons/splash-<szer>x<wys>.png + wpisy <link> w index.html
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const BG = '#FAFDFB'; // background.default jasnego motywu
const ICON = 'icons/icon-512.png';

// [szerokosc, wysokosc, device-width, device-height, pixel-ratio] - modele iPhone portrait
const SPLASHES = [
  [1290, 2796, 430, 932, 3], // 14/15/16 Pro Max
  [1179, 2556, 393, 852, 3], // 14/15/16 Pro
  [1284, 2778, 428, 926, 3], // 12/13/14 Pro Max, 14/15/16 Plus
  [1170, 2532, 390, 844, 3], // 12/13/14, 15, 16
  [1125, 2436, 375, 812, 3], // X/XS/11 Pro/12 mini/13 mini
  [1242, 2688, 414, 896, 3], // XS Max/11 Pro Max
  [828, 1792, 414, 896, 2],  // XR/11
  [1242, 2208, 414, 736, 3], // 6s/7/8 Plus
  [750, 1334, 375, 667, 2],  // SE 2/3, 6s/7/8
];

await mkdir('public/icons', { recursive: true });

for (const [width, height] of SPLASHES) {
  const iconSize = Math.round(Math.min(width, height) * 0.34);
  const icon = await sharp(ICON).resize(iconSize, iconSize).png().toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: BG },
  })
    .composite([{
      input: icon,
      left: Math.round((width - iconSize) / 2),
      top: Math.round((height - iconSize) / 2),
    }])
    .png()
    .toFile(`public/icons/splash-${width}x${height}.png`);
  console.log(`splash-${width}x${height}.png`);
}
console.log('OK');
