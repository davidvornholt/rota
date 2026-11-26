import type { SettingsChanges } from '@rota/api/api';
import type { Settings as ApiSettings } from '@rota/api/wardrobe';
import { Effect, Schema } from 'effect';
import {
  categoryDefaults,
  type GarmentCategory,
  garmentCategories,
  hasWearBudget,
  isCategory,
} from '#/shared/data/garment-types.ts';
import type { Settings } from '#/shared/data/settings.ts';
import { locationSearchLabel } from '#/shared/weather/location.ts';
import { InvalidSettings } from '../errors/settings-errors.ts';
import {
  RotationFieldsSchema,
  type RotationSettingsInput,
} from '../schemas/settings-input.ts';

/** Every category's wear budget, the saved one or Rota's default, as the settings form edits them. */
export const budgetsOf = (
  settings: Pick<Settings, 'categoryBudgets'>,
): RotationSettingsInput['categoryBudgets'] =>
  Object.fromEntries(
    garmentCategories.map((category) => [
      category,
      settings.categoryBudgets[category] ?? categoryDefaults[category].budget,
    ]),
  ) as RotationSettingsInput['categoryBudgets'];

/** The categories whose garments go to the wash; the others, such as shoes, never do. */
const washed = garmentCategories.filter((category) =>
  hasWearBudget({ category }),
);

const isWashed = (category: string): category is GarmentCategory =>
  isCategory(category) && hasWearBudget({ category });

/** The settings as the CLI's API shows them. */
export const apiSettings = (settings: Settings): ApiSettings => {
  const budgets = budgetsOf(settings);
  return {
    location:
      settings.location === null
        ? null
        : locationSearchLabel(settings.location),
    laundryDays: settings.laundryDays,
    cooldownDays: settings.cooldownDays,
    proposalHour: settings.proposalHour,
    cleanTopFrom: settings.cleanTopAnchor,
    wearBudgets: Object.fromEntries(
      washed.map((category) => [category, budgets[category]]),
    ),
  };
};

const decodeRotation = Schema.decodeUnknownEffect(RotationFieldsSchema);

/**
 * The rotation fields with the changes applied, checked against the same
 * rules as the settings form, so a client can't save what the form refuses.
 */
export const changedRotation = (settings: Settings, changes: SettingsChanges) =>
  Effect.gen(function* () {
    const budgets: Record<string, number> = { ...budgetsOf(settings) };
    for (const [category, budget] of Object.entries(
      changes.wearBudgets ?? {},
    )) {
      if (!isWashed(category)) {
        return yield* new InvalidSettings(
          `${category} is not a category that goes to the wash. Use one of ${washed.join(', ')}.`,
        );
      }
      budgets[category] = budget ?? categoryDefaults[category].budget;
    }
    return yield* decodeRotation({
      cleanTopAnchor:
        changes.cleanTopFrom === undefined
          ? settings.cleanTopAnchor
          : changes.cleanTopFrom,
      laundryDays: changes.laundryDays ?? settings.laundryDays,
      cooldownDays: changes.cooldownDays ?? settings.cooldownDays,
      proposalHour: changes.proposalHour ?? settings.proposalHour,
      categoryBudgets: budgets,
    }).pipe(Effect.mapError((error) => new InvalidSettings(error.message)));
  });
