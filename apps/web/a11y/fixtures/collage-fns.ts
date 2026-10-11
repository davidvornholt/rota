import { Effect } from 'effect';
import type {
  CollagePicture,
  CollageState,
} from '#/shared/collage/collage-state.ts';

type CollageRequest = {
  readonly data: {
    readonly entries: ReadonlyArray<{ readonly garmentId: string }>;
    readonly retry: boolean;
  };
};

/** A synthetic flat lay of the fixture garments, at the size the image model returns. */
export const fixtureCollage: CollagePicture = {
  url: '/a11y/fixtures/collage.png',
  srcSet: '/a11y/fixtures/collage.png 1088w',
  width: 1088,
  height: 1360,
};

/** An outfit with this garment is still being made. */
export const makingGarmentId = 'collage-making';
/** An outfit with this garment failed; a new attempt is made on the next ask and ready on the one after. */
export const failingGarmentId = 'collage-failing';

let retried = false;

export const outfitCollageFn = ({
  data,
}: CollageRequest): Promise<CollageState> =>
  Effect.runPromise(
    Effect.sync((): CollageState => {
      const ids = data.entries.map((entry) => entry.garmentId);
      if (ids.includes(makingGarmentId)) {
        return { status: 'pending', progress: { status: 'rendering' } };
      }
      if (ids.includes(failingGarmentId)) {
        if (data.retry) {
          retried = true;
          return { status: 'pending', progress: { status: 'queued' } };
        }
        if (!retried) {
          return {
            status: 'failed',
            message: 'Rota could not make this picture.',
          };
        }
      }
      return { status: 'ready', picture: fixtureCollage };
    }),
  );
