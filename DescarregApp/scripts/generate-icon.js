const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "assets");
const svgPath = path.join(assetsDir, "favicon.svg");
const pngPath = path.join(assetsDir, "icon.png");
const icoPath = path.join(assetsDir, "icon.ico");

function buildIcoFromPng(pngBuffer) {
  const header = Buffer.alloc(22);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt8(0, 6);
  header.writeUInt8(0, 7);
  header.writeUInt8(0, 8);
  header.writeUInt8(0, 9);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(pngBuffer.length, 14);
  header.writeUInt32LE(22, 18);

  return Buffer.concat([header, pngBuffer]);
}

async function main() {
  if (!fs.existsSync(svgPath)) {
    throw new Error(`No s'ha trobat ${svgPath}`);
  }

  const pngBuffer = await sharp(svgPath)
    .resize(256, 256, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  fs.writeFileSync(pngPath, pngBuffer);
  fs.writeFileSync(icoPath, buildIcoFromPng(pngBuffer));

  console.log(`Icona generada a ${icoPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
