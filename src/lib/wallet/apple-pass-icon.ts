import { crc32, deflateSync } from "node:zlib";

/** A flat PNG so a signed pass has the icon and logo Wallet requires. */
export function solidPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 3 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3;
      raw[i] = rgb[0];
      raw[i + 1] = rgb[1];
      raw[i + 2] = rgb[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

const INK: [number, number, number] = [28, 28, 28];
const BUTTER: [number, number, number] = [255, 224, 138];

export function passImageBuffers(): Record<string, Buffer> {
  return {
    "icon.png": solidPng(29, 29, INK),
    "icon@2x.png": solidPng(58, 58, INK),
    "icon@3x.png": solidPng(87, 87, INK),
    "logo.png": solidPng(160, 50, BUTTER),
    "logo@2x.png": solidPng(320, 100, BUTTER),
  };
}
