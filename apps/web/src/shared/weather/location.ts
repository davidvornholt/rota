/** A place the wardrobe dresses for, as the geocoder returns it and settings keep it. */
export type Location = {
  readonly name: string;
  readonly region: string;
  readonly country: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
};

/** The everyday forecast label only needs the city. */
export const locationLabel = (location: Location): string => location.name;

/** Search results retain context so identically named cities remain distinguishable. */
export const locationSearchLabel = (location: Location): string =>
  [location.name, location.region, location.country]
    .filter(
      (part, index, parts) => part !== '' && parts.indexOf(part) === index,
    )
    .join(', ');

const coordinate = (value: number, positive: string, negative: string) =>
  `${Math.abs(value).toFixed(2)}° ${value < 0 ? negative : positive}`;

/** A stored forecast's place: name, region and country can still name several places, so the coordinates tell them apart. */
export const locationPlaceLabel = (location: Location): string =>
  `${locationSearchLabel(location)} (${coordinate(location.latitude, 'N', 'S')}, ${coordinate(location.longitude, 'E', 'W')})`;
