import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { fieldClass } from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { usageFn } from '../services/people-fns.ts';

const defaultPeriod = 30;
const costDecimals = 4;
export const UsagePanel = () => {
  const formId = useId();
  const [days, setDays] = useState<7 | 30 | 365>(defaultPeriod);
  const usage = useQuery({
    queryKey: ['usage', days],
    queryFn: () => usageFn({ data: { days } }),
  });
  const total =
    usage.data?.reduce((sum, row) => sum + Number(row.estimatedUsd), 0) ?? 0;
  const unknown =
    usage.data?.reduce((sum, row) => sum + row.unknownCosts, 0) ?? 0;
  return (
    <section className="mt-14" aria-labelledby={`${formId}-usage-heading`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="type-display text-4xl" id={`${formId}-usage-heading`}>
          Usage and costs
        </h2>
        <label htmlFor={`${formId}-usage-period`}>
          Period
          <select
            className={fieldClass}
            id={`${formId}-usage-period`}
            onChange={(event) =>
              setDays(Number(event.target.value) as 7 | 30 | 365)
            }
            value={days}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={365}>Last 365 days</option>
          </select>
        </label>
      </div>
      <p className="mt-6 text-xl">
        USD {total.toFixed(costDecimals)} estimated · {unknown}{' '}
        {unknown === 1 ? 'attempt' : 'attempts'} with unknown cost
      </p>
      <p className="mt-2 text-ink-muted text-sm">
        Estimates use published rates defined in code and saved with each
        request. Provider invoices are authoritative. Missing usage or rates
        stays unknown. Foundry image costs use OpenAI reference rates; your
        Foundry invoice may differ.
      </p>
      {usage.isError ? (
        <Notice className="mt-4">
          Usage could not be loaded. Refresh to try again.
        </Notice>
      ) : null}
      <section
        aria-label="API usage"
        className="mt-6 overflow-x-auto"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: The scrollable table needs keyboard access on narrow screens.
        tabIndex={0}
      >
        <table className="w-full min-w-160 text-left text-sm">
          <caption className="sr-only">
            API usage by person and operation
          </caption>
          <thead>
            <tr>
              {[
                'Person / model',
                'Operation',
                'Attempts',
                'Failed / pending',
                'Estimate (USD)',
                'Unknown',
              ].map((heading) => (
                <th
                  className="border-rule border-b p-3"
                  key={heading}
                  scope="col"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usage.data?.map((row) => (
              <tr
                key={`${row.ownerId}-${row.provider}-${row.model}-${row.operation}`}
              >
                <th className="border-rule border-b p-3" scope="row">
                  {row.name}
                  <span className="block font-normal text-ink-muted">
                    {row.provider} · {row.model}
                  </span>
                </th>
                <td className="px-3">{row.operation}</td>
                <td className="px-3">{row.attempts}</td>
                <td className="px-3">{row.failures}</td>
                <td className="px-3">
                  {Number(row.estimatedUsd).toFixed(costDecimals)}
                </td>
                <td className="px-3">{row.unknownCosts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {usage.data?.length === 0 ? (
        <p className="mt-4 text-ink-muted">
          No API requests recorded in this period.
        </p>
      ) : null}
    </section>
  );
};
