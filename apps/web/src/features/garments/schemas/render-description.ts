import { colorName } from '#/shared/data/color-name.ts';
import type { GarmentEdit } from './garment-input.ts';

/** A garment's description for the render prompt, from its accepted or extracted fields. */
export const renderDescription = (
  garment: Pick<GarmentEdit, 'name' | 'material' | 'pattern' | 'colors'>,
): string =>
  [
    garment.name,
    garment.material === '' ? undefined : `made of ${garment.material}`,
    garment.pattern === '' || garment.pattern === 'solid'
      ? undefined
      : `with a ${garment.pattern} pattern`,
    garment.colors.length === 0
      ? undefined
      : `in ${garment.colors.map((color) => `${colorName(color.hex)} (${color.hex})`).join(' and ')}`,
  ]
    .filter((part) => part !== undefined)
    .join(', ');
