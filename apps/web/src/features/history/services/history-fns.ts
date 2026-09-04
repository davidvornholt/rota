import { createServerFn } from '@tanstack/react-start';
import { Effect, Layer, Schema } from 'effect';

import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { type Slot, slotOrder } from '#/shared/data/garment-types.ts';
import {
  type GarmentView,
  toGarmentView,
  wearFactsByGarment,
} from '#/shared/data/garment-view.ts';
import { ProposalRepository } from '#/shared/data/proposal-repository.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import {
  type WeatherDay,
  WeatherRepository,
} from '#/shared/data/weather-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import { featureRuntime } from '#/shared/runtime/infrastructure.ts';
import { type LocalDate, yearOf } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { readWardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import {
  type Adherence,
  adherence,
  type Board,
  board,
  type ColorShare,
  colorDistribution,
  mostWorn,
  neglected,
  type TemperatureRow,
  temperatureByGarment,
} from '../stats.ts';

const runtime = featureRuntime('history', () => Layer.empty);

export type CalendarDay = {
  readonly date: LocalDate;
  readonly items: ReadonlyArray<{
    readonly slot: Slot;
    readonly name: string;
    readonly imageUrl: string | undefined;
    readonly hex: string | undefined;
  }>;
};

export type HistoryView = {
  readonly today: LocalDate;
  readonly year: number;
  readonly years: ReadonlyArray<number>;
  readonly calendar: ReadonlyArray<CalendarDay>;
  readonly board: Board;
  readonly daysLogged: number;
  readonly totalWears: number;
  readonly neglected: ReadonlyArray<GarmentView>;
  readonly mostWorn: ReadonlyArray<GarmentView>;
  readonly temperature: ReadonlyArray<TemperatureRow>;
  readonly colors: {
    readonly owned: ReadonlyArray<ColorShare>;
    readonly worn: ReadonlyArray<ColorShare>;
  };
  readonly adherence: Adherence;
  readonly costPerWear: ReadonlyArray<GarmentView>;
};

const boardDays = 28;
const mostWornLimit = 6;

const earliestYear = 2000;
const latestYear = 2100;

const HistoryQuerySchema = Schema.Struct({
  year: Schema.optional(
    Schema.Int.pipe(Schema.between(earliestYear, latestYear)),
  ),
});
const decodeHistoryQuery = Schema.decodeUnknownSync(HistoryQuerySchema);

const DayQuerySchema = Schema.Struct({ date: LocalDateSchema });
const decodeDayQuery = Schema.decodeUnknownSync(DayQuerySchema);

// A function, not a module-level Effect: the browser imports this module for
// its RPC stubs, and a top-level Effect would drag the server runtime along.
const loadAll = () =>
  Effect.gen(function* () {
    const clock = yield* readWardrobeClock();
    const [garments, log, weather, proposals] = yield* Effect.all([
      Effect.flatMap(GarmentRepository, (repository) => repository.list()),
      Effect.flatMap(WearLogRepository, (repository) => repository.history()),
      Effect.flatMap(WeatherRepository, (repository) => repository.history()),
      Effect.flatMap(ProposalRepository, (repository) => repository.history()),
    ]);
    const media = yield* MediaStore;
    const facts = wearFactsByGarment(log, clock.today);
    const views = garments.map((garment) =>
      toGarmentView({
        garment,
        facts: facts.get(garment.id),
        categoryBudgets: clock.settings.categoryBudgets,
        today: clock.today,
        urlFor: media.urlFor,
      }),
    );
    return {
      clock,
      log,
      weather,
      proposals,
      views,
      byId: new Map(views.map((view) => [view.id, view] as const)),
    };
  });

export const historyFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeHistoryQuery(input ?? {}))
  .handler(
    ({ data }): Promise<HistoryView> =>
      runtime.run(
        Effect.map(
          loadAll(),
          ({ clock, log, weather, proposals, views, byId }) => {
            const years = [
              ...new Set([
                yearOf(clock.today),
                ...log.map((entry) => yearOf(entry.wornOn)),
              ]),
            ].sort((left, right) => right - left);
            const year = data.year ?? yearOf(clock.today);
            const calendarDays = new Map<
              LocalDate,
              Array<CalendarDay['items'][number]>
            >();
            for (const entry of log.filter(
              (candidate) => yearOf(candidate.wornOn) === year,
            )) {
              const garment = byId.get(entry.garmentId);
              const items = calendarDays.get(entry.wornOn) ?? [];
              items.push({
                slot: entry.slot,
                name: garment?.name ?? 'unknown garment',
                imageUrl: garment?.image?.url,
                hex: garment?.colors[0]?.hex,
              });
              calendarDays.set(entry.wornOn, items);
            }
            const calendar = [...calendarDays.entries()]
              .sort(([left], [right]) => (left < right ? -1 : 1))
              .map(([date, items]) => ({
                date,
                items: [...items].sort(
                  (left, right) =>
                    slotOrder.indexOf(left.slot) -
                    slotOrder.indexOf(right.slot),
                ),
              }));
            const pastLog = log.filter((entry) => entry.wornOn <= clock.today);
            return {
              today: clock.today,
              year,
              years,
              calendar,
              board: board(pastLog, byId, clock.today, boardDays),
              daysLogged: new Set(pastLog.map((entry) => entry.wornOn)).size,
              totalWears: pastLog.length,
              neglected: neglected(views, clock.today),
              mostWorn: mostWorn(views, mostWornLimit),
              temperature: temperatureByGarment(pastLog, weather, byId),
              colors: colorDistribution(views),
              adherence: adherence(pastLog, proposals),
              costPerWear: views
                .filter((view) => view.costPerWear !== null)
                .sort(
                  (left, right) =>
                    (left.costPerWear ?? 0) - (right.costPerWear ?? 0),
                ),
            };
          },
        ),
      ),
  );

export type DayView = {
  readonly date: LocalDate;
  readonly today: LocalDate;
  readonly weather: WeatherDay | null;
  readonly occasion: string | null;
  readonly worn: ReadonlyArray<{
    readonly slot: Slot;
    readonly garment: GarmentView;
  }>;
  /** Everything that could be worn in each slot, for the editor. */
  readonly choices: Readonly<Record<Slot, ReadonlyArray<GarmentView>>>;
  readonly headline: string | null;
};

export const dayFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .validator((input: unknown) => decodeDayQuery(input))
  .handler(
    ({ data }): Promise<DayView> =>
      runtime.run(
        Effect.gen(function* () {
          const { clock, log, weather, proposals, views, byId } =
            yield* loadAll();
          const occasion = yield* Effect.flatMap(DayNoteRepository, (notes) =>
            notes.read(data.date),
          );
          const worn = log
            .filter((entry) => entry.wornOn === data.date)
            .sort(
              (left, right) =>
                slotOrder.indexOf(left.slot) - slotOrder.indexOf(right.slot),
            )
            .flatMap((entry) => {
              const garment = byId.get(entry.garmentId);
              return garment === undefined
                ? []
                : [{ slot: entry.slot, garment }];
            });
          const eligible = (slot: Slot) =>
            views.filter(
              (view) =>
                view.status !== 'processing' && view.slots.includes(slot),
            );
          const choices: Record<Slot, ReadonlyArray<GarmentView>> = {
            bottom: eligible('bottom'),
            under: eligible('under'),
            top: eligible('top'),
            over: eligible('over'),
          };
          const decided = proposals.find(
            (proposal) =>
              proposal.forDate === data.date && proposal.status === 'confirmed',
          );
          return {
            date: data.date,
            today: clock.today,
            weather: weather.find((day) => day.date === data.date) ?? null,
            occasion,
            worn,
            choices,
            headline: decided?.payload.headline ?? null,
          };
        }),
      ),
  );
