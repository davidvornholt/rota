import { useState } from 'react';
import type {
  ProposalItemView,
  ProposalView,
} from '#/features/rota/schemas/today-view.ts';
import { ProposalSection } from '#/features/rota/ui/proposal-section.tsx';
import type { TodayController } from '#/features/rota/ui/use-today.ts';
import type { GarmentView } from '#/shared/data/garment-view.ts';
import { localDate } from '#/shared/time/local-date.ts';

const ignore = () => undefined;

export const OutfitActionsFixture = ({
  garment,
}: {
  readonly garment: GarmentView;
}) => {
  const [items, setItems] = useState<ReadonlyArray<ProposalItemView>>([
    {
      garment,
      slot: 'over',
      continued: false,
      dayOfBudget: 1,
      budget: 2,
      reason: 'An extra layer for the evening.',
    },
  ]);
  const proposal: ProposalView = {
    id: 'demo-outfit',
    status: 'pending',
    headline: 'An evening layer',
    items,
    forecastStale: false,
    occasion: 'Dinner with friends',
  };
  const today: TodayController = {
    view: {
      today: localDate('2026-09-06'),
      locationLabel: 'Berlin',
      weather: null,
      tomorrowWeather: null,
      forecastStale: false,
      occasion: proposal.occasion,
      proposal,
      worn: null,
      unloggedDays: [],
      tomorrowHint: null,
      problem: null,
      activeGarments: 1,
    },
    draftItems: [...items],
    edited: false,
    justLogged: false,
    needsDecision: false,
    deciding: false,
    rerolling: false,
    logging: false,
    busy: false,
    failure: undefined,
    decide: ignore,
    wear: ignore,
    reroll: ignore,
    pick: ignore,
    remove: (slot) =>
      setItems((current) => current.filter((item) => item.slot !== slot)),
    saveOccasion: ignore,
    savingOccasion: false,
    backfill: ignore,
    backfilling: false,
  };
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl">Today</h1>
      <ProposalSection proposal={proposal} today={today} />
    </div>
  );
};
