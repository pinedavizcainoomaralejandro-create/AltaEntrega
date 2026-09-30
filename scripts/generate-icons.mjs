// Genera los íconos de la PWA (public/icons) y el de la pestaña del navegador
// (src/app/favicon.ico, icon.svg y apple-icon.png) a partir del LogoMark
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
