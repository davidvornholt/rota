/**
 * The shape of a media key: the SHA-256 of the bytes plus an extension for
 * the MIME types the store accepts. Pure, so routes and validators can use it
 * without the store's configuration.
 */

export const extensionByMime: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const isStorableMime = (mime: string): boolean =>
  mime in extensionByMime;

const keyPattern = /^[a-f0-9]{64}\.(?<extension>jpg|png|webp)$/u;

export const isMediaKey = (key: string): boolean => keyPattern.test(key);

export const mimeOfKey = (key: string): string | undefined =>
  Object.entries(extensionByMime).find(([, extension]) =>
    key.endsWith(`.${extension}`),
  )?.[0];
