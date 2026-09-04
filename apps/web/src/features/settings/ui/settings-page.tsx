import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, useId, useState } from 'react';

import {
  categoryDefaults,
  garmentCategories,
} from '#/shared/data/garment-types.ts';
import type { Settings } from '#/shared/data/settings-repository.ts';
import {
  fieldClass,
  frameClass,
  inkButtonClass,
  labelClass,
  linkButtonClass,
} from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { type Location, locationLabel } from '#/shared/weather/location.ts';
import type { RotationSettingsInput } from '../schemas/settings-input.ts';
import {
  saveLocationFn,
  saveRotationSettingsFn,
  searchLocationsFn,
} from '../services/settings-fns.ts';

const budgetsOf = (
  settings: Settings,
): RotationSettingsInput['categoryBudgets'] =>
  Object.fromEntries(
    garmentCategories.map((category) => [
      category,
      settings.categoryBudgets[category] ?? categoryDefaults[category].budget,
    ]),
  ) as RotationSettingsInput['categoryBudgets'];

const failureMessage = (error: unknown) =>
  error instanceof Error && error.message !== ''
    ? error.message
    : 'That did not go through. Try again.';

const SearchResults = ({
  results,
  onPick,
  saving,
}: {
  readonly results: ReadonlyArray<Location>;
  readonly onPick: (location: Location) => void;
  readonly saving: boolean;
}) =>
  results.length === 0 ? (
    <p className="mt-3 text-ink-muted text-sm">
      No place by that name. Try the nearest larger town.
    </p>
  ) : (
    <ul className="mt-3 max-w-prose border-rule border-t">
      {results.map((location) => (
        <li
          className="flex items-center justify-between gap-4 border-rule border-b py-2"
          key={`${location.latitude}-${location.longitude}`}
        >
          <span className="text-ink text-sm">
            {locationLabel(location)}
            <span className="type-data ml-2 text-ink-faint text-xs">
              {location.timezone}
            </span>
          </span>
          <button
            aria-busy={saving}
            className={linkButtonClass}
            disabled={saving}
            onClick={() => onPick(location)}
            type="button"
          >
            Use this
          </button>
        </li>
      ))}
    </ul>
  );

const LocationSection = ({
  settings,
  onSaved,
}: {
  readonly settings: Settings;
  readonly onSaved: (next: Settings) => void;
}) => {
  const inputId = useId();
  const headingId = useId();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const results = useQuery({
    queryKey: ['locations', submitted],
    queryFn: () => searchLocationsFn({ data: { query: submitted } }),
    enabled: submitted.length >= 2,
  });
  const save = useMutation({
    mutationFn: (location: Location) => saveLocationFn({ data: { location } }),
    onSuccess: (next) => {
      setSubmitted('');
      setQuery('');
      onSaved(next);
    },
  });

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2 className="type-display text-3xl text-ink" id={headingId}>
        Where you dress
      </h2>
      <p className="mt-2 max-w-prose text-ink-muted text-sm">
        The forecast for this place decides the day; its time zone decides when
        the day starts.
      </p>
      <p className="mt-4 text-ink">
        {settings.location === null ? (
          <span className="text-ink-faint">No place chosen yet.</span>
        ) : (
          <>
            <span className="type-display text-2xl">
              {locationLabel(settings.location)}
            </span>
            <span className="type-data ml-3 text-ink-faint text-sm">
              {settings.location.timezone}
            </span>
          </>
        )}
      </p>
      <form
        className="mt-4 flex max-w-prose gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <div className="flex-1">
          <label className={labelClass} htmlFor={inputId}>
            {settings.location === null ? 'Find a place' : 'Change the place'}
          </label>
          <input
            autoComplete="off"
            className={[fieldClass, 'mt-2'].join(' ')}
            id={inputId}
            minLength={2}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Town or city"
            type="search"
            value={query}
          />
        </div>
        <button
          className={[inkButtonClass, 'self-end'].join(' ')}
          type="submit"
        >
          Search
        </button>
      </form>
      {results.isFetching ? (
        <p className="mt-3 text-ink-muted text-sm" role="status">
          Searching …
        </p>
      ) : null}
      {results.isError ? (
        <Notice className="mt-3" live={true}>
          {failureMessage(results.error)}
        </Notice>
      ) : null}
      {results.data !== undefined && !results.isFetching ? (
        <SearchResults
          onPick={(location) => save.mutate(location)}
          results={results.data}
          saving={save.isPending}
        />
      ) : null}
      {save.isError ? (
        <Notice className="mt-3" live={true}>
          {failureMessage(save.error)}
        </Notice>
      ) : null}
    </section>
  );
};

const RotationSection = ({
  settings,
  onSaved,
}: {
  readonly settings: Settings;
  readonly onSaved: (next: Settings) => void;
}) => {
  const cooldownId = useId();
  const hourId = useId();
  const headingId = useId();
  const [draft, setDraft] = useState<RotationSettingsInput>(() => ({
    cooldownDays: settings.cooldownDays,
    proposalHour: settings.proposalHour,
    categoryBudgets: budgetsOf(settings),
  }));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setDraft({
      cooldownDays: settings.cooldownDays,
      proposalHour: settings.proposalHour,
      categoryBudgets: budgetsOf(settings),
    });
  }, [settings]);
  const save = useMutation({
    mutationFn: () => saveRotationSettingsFn({ data: draft }),
    onSuccess: (next) => {
      setSaved(true);
      onSaved(next);
    },
  });

  return (
    <section aria-labelledby={headingId} className="mt-12">
      <h2 className="type-display text-3xl text-ink" id={headingId}>
        The rotation
      </h2>
      <form
        className="mt-4 grid gap-8"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(false);
          save.mutate();
        }}
      >
        <div className="grid max-w-prose gap-6 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor={cooldownId}>
              Rest days before a garment returns
            </label>
            <input
              className={[fieldClass, 'type-data mt-2'].join(' ')}
              id={cooldownId}
              inputMode="numeric"
              max={60}
              min={0}
              onChange={(event) =>
                setDraft({ ...draft, cooldownDays: Number(event.target.value) })
              }
              type="number"
              value={draft.cooldownDays}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={hourId}>
              Hour the day is decided
            </label>
            <input
              className={[fieldClass, 'type-data mt-2'].join(' ')}
              id={hourId}
              inputMode="numeric"
              max={23}
              min={0}
              onChange={(event) =>
                setDraft({ ...draft, proposalHour: Number(event.target.value) })
              }
              type="number"
              value={draft.proposalHour}
            />
          </div>
        </div>
        <fieldset>
          <legend className={labelClass}>Days in a row, by category</legend>
          <p className="mt-1 max-w-prose text-ink-muted text-sm">
            A garment can carry its own number, set on its page; these are the
            defaults.
          </p>
          <ul className="mt-3 grid max-w-2xl grid-cols-2 gap-x-6 sm:grid-cols-3 lg:grid-cols-5">
            {garmentCategories.map((category) => {
              const id = `budget-${category}`;
              return (
                <li className="border-rule border-t py-2" key={category}>
                  <label className="text-ink text-sm" htmlFor={id}>
                    {category}
                  </label>
                  <input
                    className={[fieldClass, 'type-data mt-1'].join(' ')}
                    id={id}
                    inputMode="numeric"
                    max={30}
                    min={1}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        categoryBudgets: {
                          ...draft.categoryBudgets,
                          [category]: Number(event.target.value),
                        },
                      })
                    }
                    type="number"
                    value={draft.categoryBudgets[category]}
                  />
                </li>
              );
            })}
          </ul>
        </fieldset>
        {save.isError ? (
          <Notice live={true}>{failureMessage(save.error)}</Notice>
        ) : null}
        <div className="flex items-center gap-4">
          <button
            aria-busy={save.isPending}
            className={inkButtonClass}
            disabled={save.isPending}
            type="submit"
          >
            {save.isPending ? 'Saving …' : 'Save rotation settings'}
          </button>
          {saved ? (
            <span className="text-ink-muted text-sm" role="status">
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </section>
  );
};

export const SettingsPage = ({ initial }: { readonly initial: Settings }) => {
  const router = useRouter();
  const [settings, setSettings] = useState(initial);
  useEffect(() => {
    setSettings(initial);
  }, [initial]);
  const onSaved = (next: Settings) => {
    setSettings(next);
    router.invalidate().catch(() => undefined);
  };
  return (
    <div className={frameClass}>
      <h1 className="type-display border-rule border-b pb-4 text-4xl text-ink sm:text-5xl">
        Settings
      </h1>
      <LocationSection onSaved={onSaved} settings={settings} />
      <RotationSection onSaved={onSaved} settings={settings} />
    </div>
  );
};
