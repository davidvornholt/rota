// These are garment colour references, not interface theme colours.
const palette = [
  ['Black', '#000000'],
  ['Charcoal', '#36454f'],
  ['Grey', '#808080'],
  ['Silver', '#c0c0c0'],
  ['White', '#ffffff'],
  ['Off-white', '#f5f0e6'],
  ['Cream', '#fff2cc'],
  ['Beige', '#d6c5a3'],
  ['Tan', '#b89368'],
  ['Brown', '#70452a'],
  ['Burgundy', '#800020'],
  ['Red', '#e02020'],
  ['Orange', '#f08020'],
  ['Yellow', '#f0d030'],
  ['Olive', '#808000'],
  ['Green', '#228b22'],
  ['Sage', '#9aaa88'],
  ['Teal', '#008080'],
  ['Navy', '#192c46'],
  ['Blue', '#336699'],
  ['Light blue', '#add8e6'],
  ['Purple', '#804080'],
  ['Lavender', '#b8a0d0'],
  ['Pink', '#efa0b8'],
] as const;

const radix = 16;
const redStart = 1;
const greenStart = 3;
const blueStart = 5;
const hexEnd = 7;
const rgb = (hex: string): readonly [number, number, number] => [
  Number.parseInt(hex.slice(redStart, greenStart), radix),
  Number.parseInt(hex.slice(greenStart, blueStart), radix),
  Number.parseInt(hex.slice(blueStart, hexEnd), radix),
];

const references = palette.map(([name, hex]) => ({ name, rgb: rgb(hex) }));

/** Nearest wardrobe reference in RGB; input is a schema-validated #RRGGBB. */
export const colorName = (hex: string): string => {
  const [red, green, blue] = rgb(hex);
  let nearest: string = palette[0][0];
  let shortestDistance = Number.POSITIVE_INFINITY;
  for (const reference of references) {
    const [r, g, b] = reference.rgb;
    const distance = (red - r) ** 2 + (green - g) ** 2 + (blue - b) ** 2;
    if (distance < shortestDistance) {
      nearest = reference.name;
      shortestDistance = distance;
    }
  }
  return nearest;
};
