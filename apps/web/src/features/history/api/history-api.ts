import { RotaApi } from '@rota/api/api';
import { Rejected } from '@rota/api/errors';
import type { HistoryDay } from '@rota/api/wardrobe';
import { Effect } from 'effect';
import { HttpApiBuilder } from 'effect/http-api';
import { asMember } from '#/shared/api/member-runtime.ts';
import { outfitItems, toApiWeather } from '#/shared/api/wire.ts';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import { slotOrder } from '#/shared/data/garment-types.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { WeatherRepository } from '#/shared/data/weather-repository.ts';
import {
  daysBetween,
  type LocalDate,
  localDate,
} from '#/shared/time/local-date.ts';
import { historyRuntime } from '../services/history-runtime.ts';

/** About a year, so one request stays a small read. */
const longestRange = 366;

/** The logged days and noted occasions between two days, oldest first. */
const historyBetween = (from: LocalDate, to: LocalDate) =>
  Effect.gen(function* () {
    const wearLog = yield* WearLogRepository;
    const notes = yield* DayNoteRepository;
    const weather = yield* WeatherRepository;
    const garments = yield* GarmentRepository;
    const [log, dayNotes, forecasts, all] = yield* Effect.all([
      wearLog.listBetween(from, to),
      notes.readRange(from, to),
      weather.readRange(from, to),
      garments.list(),
    ]);
    const names = new Map(all.map((garment) => [garment.id, garment.name]));
    const occasions = new Map(
      dayNotes.map((note) => [note.date, note.occasion]),
    );
    const weatherOn = new Map(forecasts.map((day) => [day.date, day]));
    const dates = [
      ...new Set([...log.map((entry) => entry.wornOn), ...occasions.keys()]),
    ].sort();
    return dates.map((date): HistoryDay => {
      const day = weatherOn.get(date);
      return {
        date,
        worn: outfitItems(
          log
            .filter((entry) => entry.wornOn === date)
            .sort(
              (left, right) =>
                slotOrder.indexOf(left.slot) - slotOrder.indexOf(right.slot),
            ),
          names,
        ),
        occasion: occasions.get(date) ?? null,
        weather: day === undefined ? null : toApiWeather(day),
      };
    });
  });

export const historyApi = HttpApiBuilder.group(RotaApi, 'history', (handlers) =>
  Effect.succeed(
    handlers.handle('list', ({ query }) =>
      Effect.gen(function* () {
        const from = localDate(query.from);
        const to = localDate(query.to);
        const span = daysBetween(from, to);
        if (span < 0 || span >= longestRange) {
          return yield* new Rejected({
            message: `Ask for at most ${longestRange} days, with from on or before to.`,
          });
        }
        return yield* asMember(() =>
          historyRuntime.run(historyBetween(from, to)),
        );
      }),
    ),
  ),
);
