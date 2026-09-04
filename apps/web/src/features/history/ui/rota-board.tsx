import { Link } from '@tanstack/react-router';

import {
  type Slot,
  slotLabel,
  slotOrder,
} from '#/shared/data/garment-types.ts';
import {
  formatLongDate,
  formatWeekday,
  type LocalDate,
} from '#/shared/time/local-date.ts';
import type { Board, BoardRow as BoardRowData } from '../stats.ts';

const WornCell = ({
  day,
  worn,
}: {
  readonly day: LocalDate;
  readonly worn: boolean;
}) => (
  <td className="p-0.5">
    {worn ? (
      <span
        aria-label={`Worn ${formatLongDate(day)}`}
        className="block aspect-square min-w-3 bg-ink"
        role="img"
      />
    ) : (
      <span
        aria-hidden="true"
        className="block aspect-square min-w-3 bg-paper-deep"
      />
    )}
  </td>
);

const BoardRow = ({
  row,
  days,
}: {
  readonly row: BoardRowData;
  readonly days: ReadonlyArray<LocalDate>;
}) => (
  <tr>
    <th
      className="w-40 min-w-32 py-0.5 pr-3 text-left font-normal text-ink text-sm"
      scope="row"
    >
      <Link
        className="hover:underline"
        params={{ garmentId: row.garment.id }}
        to="/wardrobe/$garmentId"
      >
        {row.garment.name}
      </Link>
    </th>
    {days.map((day, index) => (
      <WornCell day={day} key={day} worn={row.worn[index] ?? false} />
    ))}
  </tr>
);

/**
 * The rota board itself: garments down, days across, a filled square where one
 * was worn. Four squares in a row is a rotation; the eye reads the whole month
 * of them at once, which is the point.
 */
export const RotaBoard = ({
  board,
  today,
}: {
  readonly board: Board;
  readonly today: LocalDate;
}) => {
  if (board.rows.length === 0) {
    return (
      <p className="mt-4 max-w-prose text-ink-muted">
        Nothing logged in the last four weeks.
      </p>
    );
  }
  const bySlot = slotOrder
    .map((slot) => ({
      slot,
      rows: board.rows.filter((row) => row.slot === slot),
    }))
    .filter((group) => group.rows.length > 0);
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Garments worn over the last {board.days.length} days
        </caption>
        <thead>
          <tr>
            <th className="sr-only" scope="col">
              Garment
            </th>
            {board.days.map((day) => (
              <th
                abbr={formatLongDate(day)}
                className={[
                  'type-data pb-1 text-center font-normal text-[10px]',
                  day === today ? 'text-ink' : 'text-ink-faint',
                ].join(' ')}
                key={day}
                scope="col"
              >
                {formatWeekday(day, 'short').charAt(0)}
              </th>
            ))}
          </tr>
        </thead>
        {bySlot.map(({ slot, rows }) => (
          <tbody key={slot}>
            <tr>
              <th
                className="type-eyebrow border-rule border-t pt-3 pb-1 text-left"
                colSpan={board.days.length + 1}
                scope="rowgroup"
              >
                {slotLabel[slot as Slot]}
              </th>
            </tr>
            {rows.map((row) => (
              <BoardRow days={board.days} key={row.garment.id} row={row} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
};
