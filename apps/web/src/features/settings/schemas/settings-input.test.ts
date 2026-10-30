import { expect, it } from 'bun:test';

import { decodeSaveLocationInput } from './settings-input.ts';

const berlin = {
  name: 'Berlin',
  region: 'Berlin',
  country: 'Germany',
  latitude: 52.52,
  longitude: 13.41,
  timezone: 'Europe/Berlin',
};

it('saves only a location whose time zone the wardrobe clock can resolve', () => {
  expect(decodeSaveLocationInput({ location: berlin }).location).toEqual(
    berlin,
  );
  expect(() =>
    decodeSaveLocationInput({
      location: { ...berlin, timezone: 'Europe/Bergstadt' },
    }),
  ).toThrow();
});
