const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const assetsDir = path.join(root, "assets");
const svgPath = path.join(assetsDir, "favicon.svg");
const pngPath = path.join(assetsDir, "icon.png");
const icoPath = path.join(assetsDir, "icon.ico");
const iconSizes = [16, 24, 32, 48, 64, 128, 256];

function buildIcoFromPngEntries(entries) {
  const headerSize = 6;
  const directoryEntrySize = 16;
  const imageOffset = headerSize + (directoryEntrySize * entries.length);
  const header = Buffer.alloc(imageOffset);

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let currentOffset = imageOffset;

  entries.forEach((entry, index) => {
    const offset = headerSize + (directoryEntrySize * index);
    const iconSize = entry.size >= 256 ? 0 : entry.size;

    header.writeUInt8(iconSize, offset);
    header.writeUInt8(iconSize, offset + 1);
    header.writeUInt8(0, offset + 2);
    header.writeUInt8(0, offset + 3);
    header.writeUInt16LE(1, offset + 4);
    header.writeUInt16LE(32, offset + 6);
    header.writeUInt32LE(entry.buffer.length, offset + 8);
    header.writeUInt32LE(currentOffset, offset + 12);

    currentOffset += entry.buffer.length;
  });

  return Buffer.concat([header, ...entries.map((entry) => entry.buffer)]);
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

  const icoEntries = await Promise.all(iconSizes.map(async (size) => {
    return {
      size,
      buffer: await sharp(svgPath)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer()
    };
  }));

  fs.writeFileSync(pngPath, pngBuffer);
  fs.writeFileSync(icoPath, buildIcoFromPngEntries(icoEntries));

  console.log(`Icona generada a ${icoPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
