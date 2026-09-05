export const studioPrompt = ({
  description,
  instructions,
}: {
  readonly description: string;
  readonly instructions: string;
}): string =>
  [
    `A studio product photograph of exactly this garment: ${description}.`,
    'Lay it perfectly flat and neatly arranged, front view, centred, filling most of the frame with even margins.',
    'Orient the garment naturally upright in the portrait frame, regardless of the source photo orientation; rotate sideways or upside-down garments into this position.',
    'For tops and dresses, place the neckline at the top and the hem at the bottom; for trousers, shorts and skirts, place the waistband at the top and the leg openings or hem at the bottom.',
    'Preserve natural proportions, even when an upright garment is wider than it is tall; do not rotate it sideways to fill the frame.',
    "Smooth incidental wrinkles and storage folds for a neatly steamed appearance. Preserve intentional pleats, gathers, pressed creases, natural fabric texture, and the garment's shape.",
    'Soft, even studio lighting; no harsh shadows.',
    'Use the garment description as the source of truth for colour and other corrected attributes. Hex values specify the target colours even when the photo or garment name suggests a different colour.',
    'Preserve the texture, seams, buttons and proportions from the photo unless a correction below asks otherwise.',
    instructions.trim() === ''
      ? ''
      : `Additional corrections from the owner: ${instructions.trim()}`,
    'Keep the result a studio garment photograph. No people, no mannequin, no hanger, no props, no text, no watermark.',
  ]
    .filter(Boolean)
    .join(' ');
