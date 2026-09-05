export type GarmentScaleOption = {
  readonly value: number;
  readonly label: string;
  readonly description: string;
};

export const warmthOptions: ReadonlyArray<GarmentScaleOption> = [
  {
    value: 1,
    label: 'Light',
    description:
      'Little insulation, like a linen shirt or thin tee. Good for warm weather or layering.',
  },
  {
    value: 2,
    label: 'Medium',
    description:
      'Some insulation, like an Oxford shirt or light knit. Good for mild weather.',
  },
  {
    value: 3,
    label: 'Heavy',
    description:
      'Plenty of insulation, like a thick wool jumper. Good for cold weather.',
  },
];

export const formalityOptions: ReadonlyArray<GarmentScaleOption> = [
  {
    value: 1,
    label: 'Casual',
    description: 'Relaxed everyday or sports clothing, like a tee or hoodie.',
  },
  {
    value: 2,
    label: 'Smart',
    description:
      'Polished everyday or office clothing, like chinos or an Oxford shirt.',
  },
  {
    value: 3,
    label: 'Formal',
    description:
      'Dressy occasion clothing, like suit trousers or a dress shirt. The full outfit matters too.',
  },
];

const describeScale = (options: ReadonlyArray<GarmentScaleOption>): string =>
  options
    .map((option) => `${option.value} = ${option.label}: ${option.description}`)
    .join(' ');

export const warmthInstruction = `Judge insulation, not physical weight. ${describeScale(warmthOptions)} Consider the garment's material and construction, and how it is layered.`;
export const formalityInstruction = `Judge how dressy the garment looks. ${describeScale(formalityOptions)} Smart includes both smart casual and business casual.`;
