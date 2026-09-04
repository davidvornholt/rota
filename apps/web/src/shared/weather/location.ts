/** A place the wardrobe dresses for, as the geocoder returns it and settings keep it. */
export type Location = {
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
};

export const locationLabel = (location: Location): string =>
  [location.name, location.region, location.country]
    .filter(
      (part, index, parts) => part !== '' && parts.indexOf(part) === index,
    )
    .join(', ');
