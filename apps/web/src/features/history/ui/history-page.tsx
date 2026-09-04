import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useId } from 'react';

import { frameClass, tabActiveClass, tabClass } from '#/shared/ui/classes.ts';
import type { HistoryView } from '../services/history-fns.ts';
import { ColorBars, GarmentStrip, Stat, TemperatureStrips } from './charts.tsx';
import { RotaBoard } from './rota-board.tsx';
import { YearCalendar } from './year-calendar.tsx';

const Section = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) => {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-12">
      <h2 className="type-display text-3xl text-ink" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
};

const percentScale = 100;

const percent = (part: number, whole: number) =>
  whole === 0 ? '—' : `${Math.round((part / whole) * percentScale)}%`;

/** Looking back: the board, the year, and what the numbers say. */
export const HistoryPage = ({ view }: { readonly view: HistoryView }) => (
  <div className={frameClass}>
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-rule border-b pb-4">
      <h1 className="type-display text-4xl text-ink sm:text-5xl">History</h1>
      <nav aria-label="Year">
        <ul className="flex gap-5">
          {view.years.map((year) => (
            <li key={year}>
              <Link
                className={[
                  tabClass,
                  year === view.year ? tabActiveClass : '',
                ].join(' ')}
                search={{ year }}
                to="/history"
              >
                {year}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>

    <dl className="mt-6 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
      <Stat label="Days logged" value={String(view.daysLogged)} />
      <Stat label="Garments worn" value={String(view.totalWears)} />
      <Stat
        label="Wore the first proposal"
        value={percent(
          view.adherence.acceptedFirst,
          view.adherence.decidedDays,
        )}
      />
      <Stat
        label="Chose your own"
        value={percent(view.adherence.overridden, view.adherence.decidedDays)}
      />
    </dl>

    <Section title="The last four weeks">
      <RotaBoard board={view.board} today={view.today} />
    </Section>

    <Section title={String(view.year)}>
      <p className="mt-2 max-w-prose text-ink-muted text-sm">
        Each day stacks the colours of what you wore, trousers at the bottom.
        Open a day to correct it.
      </p>
      <div className="mt-6">
        <YearCalendar
          days={view.calendar}
          today={view.today}
          year={view.year}
        />
      </div>
    </Section>

    <Section title="What you wear at which temperature">
      <TemperatureStrips rows={view.temperature} />
    </Section>

    <div className="grid gap-12 lg:grid-cols-2">
      <Section title="Most worn">
        <GarmentStrip
          empty="Nothing worn yet."
          fact={(garment) => `${garment.wears}×`}
          garments={view.mostWorn}
        />
      </Section>
      <Section title="Neglected this season">
        <GarmentStrip
          empty="Everything in season has been worn in the last three months."
          fact={(garment) =>
            garment.daysSinceWorn === null
              ? 'never worn'
              : `${garment.daysSinceWorn} d ago`
          }
          garments={view.neglected}
        />
      </Section>
    </div>

    <Section title="Colours">
      <ColorBars owned={view.colors.owned} worn={view.colors.worn} />
    </Section>

    {view.costPerWear.length > 0 ? (
      <Section title="Cost per wear">
        <GarmentStrip
          empty=""
          fact={(garment) => `€${(garment.costPerWear ?? 0).toFixed(2)}`}
          garments={view.costPerWear}
        />
      </Section>
    ) : null}
  </div>
);
