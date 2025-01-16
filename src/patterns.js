// Creates an 8x8 pixel pattern
const createPatternData = (pixelFunction) => {
  return new Uint8Array(64).map((_, i) => {
    const x = i % 8;
    const y = Math.floor(i / 8);
    return pixelFunction(x, y) ? 255 : 0;
  });
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