import { Schema } from 'effect';
import type { StudioProgress } from '#/shared/ai/studio-progress.ts';
import { OutfitEntriesSchema } from '#/shared/data/outfit.ts';

export type CollagePicture = {
  readonly url: string;
  readonly srcSet: string;
  readonly width: number;
  readonly height: number;
};

/** Where an outfit's collage stands; `empty` when none of its garments has a picture. */
export type CollageState =
  | { readonly status: 'empty' }
  | { readonly status: 'pending'; readonly progress: StudioProgress }
  | { readonly status: 'ready'; readonly picture: CollagePicture }
  | { readonly status: 'failed'; readonly message: string };

/** `retry` makes a new attempt after a failed one; otherwise a failure is answered as stored. */
export const decodeCollageRequest = Schema.decodeUnknownSync(
  Schema.Struct({ entries: OutfitEntriesSchema, retry: Schema.Boolean }),
);
