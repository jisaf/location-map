// Creates an 8x8 pixel pattern with RGBA values
const createPatternData = (pixelFunction) => {
  const data = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i++) {
    const x = i % 8;
    const y = Math.floor(i / 8);
    const value = pixelFunction(x, y) ? 255 : 0;
    const idx = i * 4;
    data[idx] = value;     // R
    data[idx + 1] = value; // G
    data[idx + 2] = value; // B
    data[idx + 3] = value; // A
  }
  return data;
};

export const patterns = {
  'large-metro': {
    width: 8,
    height: 8,
    data: createPatternData((x, y) => x === y || x === (7 - y) || y === 4)
  },
  'metro': {
    width: 8,
    height: 8,
    data: createPatternData((x, y) => x === y || x === (7 - y))
  },
  'micro': {
    width: 8,
    height: 8,
    data: createPatternData((x, y) => x % 4 === 0)
  },
  'rural': {
    width: 8,
    height: 8,
    data: createPatternData((x, y) => y === 4)
  },
  'ceac': {
    width: 8,
    height: 8,
    data: createPatternData((x, y) => x === y)
  }
};