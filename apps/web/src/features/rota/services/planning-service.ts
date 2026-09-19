import { Effect } from 'effect';
import { DayNoteRepository } from '#/shared/data/day-note-repository.ts';
import { cleanTopOn } from '#/shared/data/garment-care.ts';
import { GarmentRepository } from '#/shared/data/garment-repository.ts';
import {
  toGarmentView,
  wearFactsByGarment,
} from '#/shared/data/garment-view.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import { WearLogRepository } from '#/shared/data/wear-log-repository.ts';
import { MediaStore } from '#/shared/media/media-store.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';
import { ProposalStateError } from '../errors/rota-errors.ts';
import type { PlanningChange } from '../schemas/planning-input.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import {
  forecastChanged,
  projectedLog,
  validateEntries,
} from './planning-rules.ts';
import { ProposalService } from './proposal-service.ts';
import { TodayService } from './today-service.ts';

export const planningView = (clock: WardrobeClock) =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    const outfits = yield* OutfitRepository;
    const wearLog = yield* WearLogRepository;
    const media = yield* MediaStore;
    const today = yield* TodayService;
    const [day, all, history, plan, saved, todayPlan] = yield* Effect.all([
      today.view(clock),
      garments.list(),
      wearLog.history(),
      outfits.plan(clock.today),
      outfits.list(),
      outfits.plan(clock.actualToday),
    ]);
    const log = projectedLog(history, todayPlan, clock);
    const cleanTop = cleanTopOn(
      clock.today,
      clock.settings.cleanTopAnchor,
      plan.cleanTop,
    );
    const facts = wearFactsByGarment(log, clock.today);
    const wardrobe = all
      .filter((garment) => garment.status === 'active')
      .map((garment) =>
        toGarmentView({
          garment,
          studioProgress: undefined,
          facts: facts.get(garment.id),
          categoryBudgets: clock.settings.categoryBudgets,
          today: clock.today,
          urlFor: media.urlFor,
        }),
      );
    const warnings: Array<string> = [];
    if (forecastChanged(plan.forecast, day.weather)) {
      warnings.push(
        'The forecast has changed. Review your outfit or ask for another suggestion.',
      );
    }
    if (
      clock.today > clock.actualToday &&
      !history.some((entry) => entry.wornOn === clock.actualToday)
    ) {
      warnings.push(
        todayPlan.entries === null
          ? 'Log today’s outfit to make tomorrow’s rotation more accurate.'
          : 'Tomorrow assumes you wear today’s saved outfit.',
      );
    }
    return {
      day: {
        ...day,
        unlogged: clock.today === clock.actualToday ? day.unlogged : null,
      },
      actualToday: clock.actualToday,
      plan,
      cleanTop,
      wardrobe,
      outfits: saved,
      warnings,
    } satisfies PlanningView;
  });

const applyEntryChange = (
  clock: WardrobeClock,
  change: Extract<PlanningChange, { action: 'suggest' | 'plan' | 'wear' }>,
) =>
  Effect.gen(function* () {
    const garments = yield* GarmentRepository;
    const proposals = yield* ProposalService;
    const outfits = yield* OutfitRepository;
    const all = yield* garments.list();
    yield* validateEntries(change.entries, all, change.action !== 'suggest');
    if (change.action === 'suggest') {
      yield* proposals.complete(clock, change.entries);
      return;
    }
    const unavailable = change.entries.some(
      (entry) =>
        all.find((garment) => garment.id === entry.garmentId)?.inLaundry,
    );
    if (unavailable) {
      return yield* new ProposalStateError(
        'A selected piece is in the laundry. Mark it washed or choose another.',
      );
    }
    if (change.action === 'wear') {
      if (clock.today !== clock.actualToday) {
        return yield* new ProposalStateError(
          'Tomorrow has not happened yet. Save it as a plan.',
        );
      }
      yield* proposals.wear(clock, change.entries);
    } else {
      const today = yield* TodayService;
      const view = yield* today.view(clock);
      if (view.worn !== null) {
        return yield* new ProposalStateError(
          'This day is already logged. Edit it in history.',
        );
      }
      yield* outfits.savePlan(clock.today, {
        entries: change.entries,
        basedOn: change.basedOn,
        forecast: view.weather,
      });
    }
  });

export const changePlanning = (clock: WardrobeClock, change: PlanningChange) =>
  Effect.gen(function* () {
    const outfits = yield* OutfitRepository;
    switch (change.action) {
      case 'suggest':
      case 'plan':
      case 'wear':
        yield* applyEntryChange(clock, change);
        break;
      case 'note': {
        const notes = yield* DayNoteRepository;
        yield* notes.save(clock.today, change.text.trim());
        break;
      }
      case 'clean-top':
        yield* outfits.setCleanTop(clock.today, change.value);
        break;
      case 'care': {
        const garments = yield* GarmentRepository;
        yield* garments.setCare(change.ids, change.care, clock.actualToday);
        break;
      }
      case 'save-outfit': {
        const garments = yield* GarmentRepository;
        yield* validateEntries(change.entries, yield* garments.list(), true);
        if (change.name.trim() === '') {
          return yield* new ProposalStateError('Give this outfit a name.');
        }
        yield* outfits.save({
          id: change.id,
          name: change.name.trim(),
          entries: change.entries,
        });
        break;
      }
      case 'delete-outfit':
        yield* outfits.remove(change.id);
        break;
      default:
        break;
    }
    return yield* planningView(clock);
  });
