// Genera los íconos de la PWA (public/icons) y el de la pestaña del navegador
// (src/app/favicon.ico, icon.svg y apple-icon.png), y los de las apps Android e iOS, a partir del LogoMark
// (src/components/brand/Logo.tsx). Ejecutar: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Las lomas llegan al borde para que no queden franjas al recortar el ícono.
const art = `
  <rect width="40" height="40" fill="#1c5136" />
  <circle cx="26" cy="17" r="6" fill="#f29e33" />
  <path d="M0 31c6-8 12-10 18-10s8 4 12 4 5-2 10-4v19H0z" fill="#4f9a6c" />
  <path d="M0 35c7-4 13-6 21-6s10 2 19 1v10H0z" fill="#aed5ba" />`;

// Sin esquinas: Android (maskable) e iOS recortan el ícono a su forma.
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">${art}</svg>`;

// Esquinas redondeadas, como en la web.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <clipPath id="c"><rect width="40" height="40" rx="12" /></clipPath>
  <g clip-path="url(#c)">${art}</g>
</svg>`;

const outputs = [
  { file: "icon-192.png", svg: rounded, size: 192 },
  { file: "icon-512.png", svg: rounded, size: 512 },
  { file: "icon-maskable-512.png", svg: fullBleed, size: 512 },
];

await mkdir("public/icons", { recursive: true });
for (const { file, svg, size } of outputs) {
  await sharp(Buffer.from(svg), { density: 1200 }).resize(size, size).png().toFile(`public/icons/${file}`);
  console.log(`public/icons/${file}`);
}

// Pestaña del navegador: icon.svg para los navegadores que lo usan y
// favicon.ico (16, 32 y 48 px, PNG dentro del .ico) para el resto.
await writeFile("src/app/icon.svg", rounded);
console.log("src/app/icon.svg");

// iPhone: pantalla de inicio (iOS recorta las esquinas).
await sharp(Buffer.from(fullBleed), { density: 1200 }).resize(180, 180).png().toFile("src/app/apple-icon.png");
console.log("src/app/apple-icon.png");

const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((size) => sharp(Buffer.from(rounded), { density: 1200 }).resize(size, size).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const entry = 6 + 16 * i;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(pngs[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += pngs[i].length;
});
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...pngs]));
console.log("src/app/favicon.ico");

// App Android (Capacitor). Sale de aquí solo si ya existe la carpeta android/.
const androidRes = "android/app/src/main/res";
const hasAndroid = await sharp(`${androidRes}/drawable/splash.png`).metadata().then(() => true, () => false);
if (hasAndroid) {
  // Círculo para los lanzadores que piden ic_launcher_round.
  const round = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
  <clipPath id="c"><circle cx="20" cy="20" r="20" /></clipPath>
  <g clip-path="url(#c)">${art}</g>
</svg>`;
  // Densidades de Android: el ícono mide 48 dp y la capa adaptativa 108 dp.
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [density, scale] of Object.entries(densities)) {
    const dir = `${androidRes}/mipmap-${density}`;
    const launcher = [
      { file: "ic_launcher.png", svg: rounded, size: 48 * scale },
      { file: "ic_launcher_round.png", svg: round, size: 48 * scale },
      // Capa adaptativa sin bordes: el lanzador la recorta a su forma.
      { file: "ic_launcher_foreground.png", svg: fullBleed, size: 108 * scale },
    ];
    for (const { file, svg, size } of launcher) {
      await sharp(Buffer.from(svg), { density: 1200 }).resize(size, size).png().toFile(`${dir}/${file}`);
    }
    console.log(`${dir}/ic_launcher*.png`);
  }

  // Pantalla de carga: el logo centrado sobre el fondo crema de la web.
  const splashDirs = ["drawable", ...["land", "port"].flatMap((o) => Object.keys(densities).map((d) => `drawable-${o}-${d}`))];
  for (const dir of splashDirs) {
    const file = `${androidRes}/${dir}/splash.png`;
    const { width, height } = await sharp(file).metadata();
    const logoSize = Math.round(Math.min(width, height) * 0.3);
    const logo = await sharp(Buffer.from(rounded), { density: 1200 }).resize(logoSize, logoSize).png().toBuffer();
    const splash = await sharp({ create: { width, height, channels: 3, background: "#faf6ef" } })
      .composite([{ input: logo, gravity: "center" }])
      .png()
      .toBuffer();
    await writeFile(file, splash);
  }
  console.log(`${androidRes}/drawable*/splash.png`);
}

// App iOS (Capacitor). Sale de aquí solo si ya existe la carpeta ios/.
const iosAssets = "ios/App/App/Assets.xcassets";
const hasIos = await sharp(`${iosAssets}/Splash.imageset/splash-2732x2732.png`).metadata().then(() => true, () => false);
if (hasIos) {
  // App Store rechaza íconos con transparencia; iOS recorta las esquinas.
  await sharp(Buffer.from(fullBleed), { density: 1200 })
    .resize(1024, 1024)
    .flatten({ background: "#1c5136" })
    .removeAlpha()
    .png()
    .toFile(`${iosAssets}/AppIcon.appiconset/AppIcon-512@2x.png`);
  console.log(`${iosAssets}/AppIcon.appiconset/AppIcon-512@2x.png`);

  // Pantalla de carga cuadrada: el teléfono solo muestra la franja central,
  // así que el logo va pequeño respecto al cuadrado.
  const logo = await sharp(Buffer.from(rounded), { density: 1200 }).resize(400, 400).png().toBuffer();
  const splash = await sharp({ create: { width: 2732, height: 2732, channels: 3, background: "#faf6ef" } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toBuffer();
  for (const suffix of ["", "-1", "-2"]) {
    await writeFile(`${iosAssets}/Splash.imageset/splash-2732x2732${suffix}.png`, splash);
  }
  console.log(`${iosAssets}/Splash.imageset/splash-2732x2732*.png`);
}
