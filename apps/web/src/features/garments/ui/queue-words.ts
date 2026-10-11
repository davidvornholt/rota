/** What a card in the queue says while a photo is not yet a garment. */
export type QueueWords = {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
};

export const waitingWords: QueueWords = {
  eyebrow: 'Next',
  title: 'Waiting to send …',
  body: 'It goes as soon as the photos ahead of it are through.',
};

export const sendingWords: QueueWords = {
  eyebrow: 'Sending',
  title: 'Sending the photo …',
  body: 'It is made smaller on this device first, so it travels quickly.',
};

/**
 * The server has the photo. A card still waiting for the queue to show it says
 * the same as the queue's own card, so the hand-over is not seen.
 */
export const readingWords: QueueWords = {
  eyebrow: 'Reading',
  title: 'Looking at the photo …',
  body: 'The garment is being named and measured, then photographed flat for the wardrobe. The card fills in as it lands.',
};
