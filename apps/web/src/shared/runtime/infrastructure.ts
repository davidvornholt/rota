/**
 * Everything a feature needs from below it: the SQL client over the one pool,
 * the repositories, the media store, the two model clients, and the weather
 * API. Features add their own services on top and turn the result into a
 * runtime with `featureRuntime`, which is the one place an Effect becomes the
 * promise TanStack Start speaks in.
 *
 * Nothing here runs at import. Building a runtime reads the validated
 * environment and touches the pool, and the client bundle imports route files
 * that import features; a pool opened there would be a pool opened in a browser.
 */

import type { SqlClient } from '@effect/sql/SqlClient';
import type { SqlError } from '@effect/sql/SqlError';
import { pgClientLayer } from '@rota/db/effect-client';
import { Cause, Effect, type Fiber, Layer, ManagedRuntime } from 'effect';

import { Gemini } from '#/shared/ai/gemini.ts';
import { StudioRenderer } from '#/shared/ai/studio-renderer.ts';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { ProposalRepository } from '#/shared/data/proposal-repository.ts';
import { SettingsRepository } from '#/shared/data/settings-repository.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { WeatherRepository } from '#/shared/data/weather-repository.ts';
import { pool } from '#/shared/db/pool.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { WeatherApi } from '#/shared/weather/open-meteo.ts';

export type Infrastructure =
  | SqlClient
  | GarmentRepository
  | WearLogRepository
  | ProposalRepository
  | SettingsRepository
  | WeatherRepository
  | DayNoteRepository
  | MediaStore
  | Gemini
  | StudioRenderer
  | WeatherApi;

export const infrastructureLayer: Layer.Layer<Infrastructure, SqlError> =
  Layer.mergeAll(
    GarmentRepository.Default,
    WearLogRepository.Default,
    ProposalRepository.Default,
    SettingsRepository.Default,
    WeatherRepository.Default,
    DayNoteRepository.Default,
    MediaStore.Default,
    Gemini.Default,
    StudioRenderer.Default,
    WeatherApi.Default,
  ).pipe(Layer.provideMerge(Layer.suspend(() => pgClientLayer(pool))));

const logged = <A, E, R>(
  label: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.tapErrorCause((cause) => Effect.logError(`${label} failed.`, cause)),
    Effect.tapDefect((defect) =>
      Effect.logError(`${label} died.`, Cause.die(defect)),
    ),
  );

/**
 * A lazily built runtime for one feature: its services provided over the
 * shared infrastructure, built once per process on first use. `run` is for a
 * request that waits for the answer; `fork` is for work that outlives the
 * request, such as reading a photo after the upload has already been answered.
 *
 * The layer arrives as a thunk so nothing is composed until the first call.
 * Server-function modules are also imported by the browser for their RPC
 * stubs, so a runtime must never be exported from one: an exported binding
 * survives dead-code elimination and would drag the server into the client.
 */
export const featureRuntime = <R, E>(
  label: string,
  featureLayer: () => Layer.Layer<R, E, Infrastructure>,
) => {
  type Services = R | Infrastructure;
  let runtime:
    | ManagedRuntime.ManagedRuntime<Services, E | SqlError>
    | undefined;
  const get = () => {
    if (runtime === undefined) {
      runtime = ManagedRuntime.make(
        Layer.provideMerge(featureLayer(), infrastructureLayer),
      );
    }
    return runtime;
  };

  const run = <A, E2>(effect: Effect.Effect<A, E2, Services>): Promise<A> =>
    get().runPromise(logged(label, effect));

  const fork = <A, E2>(
    effect: Effect.Effect<A, E2, Services>,
  ): Fiber.RuntimeFiber<A, E | E2 | SqlError> =>
    get().runFork(logged(label, effect));

  return { run, fork };
};
