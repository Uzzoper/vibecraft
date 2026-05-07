const fs = require("fs");
const zlib = require("zlib");

function createPNG(width, height, rgba) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk("IHDR", ihdrData);

  // IDAT chunk: raw image data with filter byte (0) per row
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const offset = y * (width * 4 + 1);
    rawData[offset] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const pixOffset = offset + 1 + x * 4;
      rawData[pixOffset] = rgba[0];
      rawData[pixOffset + 1] = rgba[1];
      rawData[pixOffset + 2] = rgba[2];
      rawData[pixOffset + 3] = rgba[3];
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

// CRC32 table
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const textures = [
  { name: "grass", rgba: [76, 153, 0, 255] },    // green
  { name: "dirt", rgba: [121, 85, 58, 255] },     // brown
  { name: "stone", rgba: [128, 128, 128, 255] },   // gray
  { name: "wood", rgba: [153, 102, 51, 255] },     // light brown
  { name: "leaves", rgba: [0, 102, 0, 255] },      // dark green
];

textures.forEach(({ name, rgba }) => {
  const png = createPNG(16, 16, rgba);
  fs.writeFileSync(`public/textures/${name}.png`, png);
  console.log(`Created public/textures/${name}.png`);
});
