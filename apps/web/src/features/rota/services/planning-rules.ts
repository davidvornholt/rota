import { Effect } from 'effect';
import type { Garment } from '#/shared/data/garment.ts';
import type {
  DayPlan,
  ForecastSnapshot,
} from '#/shared/data/outfit-repository.ts';
import type {
  OutfitEntry,
  WearEntry,
} from '#/shared/data/wear-log-repository.ts';
import { addDays, type LocalDate } from '#/shared/time/local-date.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ProposalStateError } from '../errors/rota-errors.ts';

export const dateClock = (clock: WardrobeClock, date: LocalDate) =>
  date < clock.actualToday || date > addDays(clock.actualToday, 1)
    ? Effect.fail(new ProposalStateError('Choose today or tomorrow.'))
    : Effect.succeed({ ...clock, today: date });

export const validateEntries = (
  entries: ReadonlyArray<OutfitEntry>,
  all: ReadonlyArray<Garment>,
  complete: boolean,
) => {
  const slots = new Set(entries.map((entry) => entry.slot));
  if (
    slots.size !== entries.length ||
    new Set(entries.map((entry) => entry.garmentId)).size !== entries.length
  ) {
    return Effect.fail(new ProposalStateError('Choose each piece only once.'));
  }
  if (complete && !(slots.has('top') && slots.has('bottom'))) {
    return Effect.fail(
      new ProposalStateError('Choose a top and a bottom first.'),
    );
  }
  const invalid = entries.find(
    (entry) =>
      !all.some(
        (garment) =>
          garment.id === entry.garmentId &&
          garment.status === 'active' &&
          garment.slots.includes(entry.slot),
      ),
  );
  return invalid === undefined
    ? Effect.void
    : Effect.fail(
        new ProposalStateError(
          'A piece is no longer available for that slot. Choose another.',
        ),
      );
};

/** Plans inform tomorrow without ever being recorded as actual wear. */
export const projectedLog = (
  log: ReadonlyArray<WearEntry>,
  plan: DayPlan,
  clock: WardrobeClock,
): ReadonlyArray<WearEntry> =>
  clock.today > clock.actualToday &&
  !log.some((entry) => entry.wornOn === clock.actualToday)
    ? [
        ...log,
        ...(plan.entries ?? []).map(
          (entry): WearEntry => ({
            ...entry,
            wornOn: clock.actualToday,
            source: 'override',
          }),
        ),
      ]
    : log;

const temperatureChange = 5;
const rainThreshold = 50;
export const forecastChanged = (
  before: ForecastSnapshot | null,
  after: ForecastSnapshot | null,
): boolean =>
  before !== null &&
  after !== null &&
  (Math.abs(before.high - after.high) >= temperatureChange ||
    Math.abs(before.low - after.low) >= temperatureChange ||
    before.precipitationProbability >= rainThreshold !==
      after.precipitationProbability >= rainThreshold);
