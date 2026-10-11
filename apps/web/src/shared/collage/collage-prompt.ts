import type { Slot } from '#/shared/data/garment-types.ts';
import { upperBodySlots } from '#/shared/data/garment-types.ts';

const roles: Readonly<Record<Slot, string>> = {
  under: 'the base layer',
  top: 'the top',
  over: 'the outer layer',
  bottom: 'the bottom',
  shoes: 'the shoes',
  bag: 'the bag',
};

const besideTheClothes: ReadonlySet<Slot> = new Set(['shoes', 'bag']);

/**
 * Asks for one styled flat lay of exactly the garments in the input images,
 * numbered in the order the images are sent.
 */
export const collagePrompt = (
  pieces: ReadonlyArray<{ readonly slot: Slot; readonly name: string }>,
): string => {
  const list = pieces
    .map(
      (piece, index) =>
        `image ${index + 1}: ${piece.name}, ${roles[piece.slot]}`,
    )
    .join('; ');
  const layered =
    pieces.filter((piece) => upperBodySlots.has(piece.slot)).length > 1;
  const beside = pieces
    .filter((piece) => besideTheClothes.has(piece.slot))
    .map((piece) => roles[piece.slot]);
  return [
    `An editorial flat-lay photograph of one outfit, seen from directly above, made from exactly the garments in the input images (${list}).`,
    `Arrange the pieces the way a stylist lays out this outfit for a fashion flat lay, so it reads as one look${layered ? ': the upper-body layers overlap as worn, from the base layer underneath to the outer layer on top,' : ''} with relaxed, natural folds.`,
    ...(beside.length === 0
      ? []
      : [`Place ${beside.join(' and ')} beside the clothes.`]),
    'If an input image shows a garment on a person, a hanger or a surface, take only the garment.',
    'Keep every garment exactly as shown in its input image: the same colour, pattern, fabric texture, collar, buttons, pockets, labels and proportions. Do not redesign, recolour or simplify them.',
    'Keep the garments at a consistent real-world scale to each other, and show every garment completely inside the frame with even margins.',
    'Plain, seamless, warm light-grey paper background. Soft daylight from one side with gentle, realistic contact shadows.',
    'Add nothing that is not in the input images: no other clothing, shoes, bags, belts, watches, jewellery, sunglasses, plants, props, hands, people, text or watermark.',
  ].join(' ');
};
