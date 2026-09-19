import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { fieldClass, quietButtonClass } from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { priceFn, pricesFn, usageFn } from '../services/people-fns.ts';

const rateFields = [
  ['input', 'Text input'],
  ['output', 'Text output / thinking'],
  ['imageInput', 'Image input'],
  ['imageOutput', 'Image output'],
  ['cachedInput', 'Cached input'],
] as const;
const defaultPeriod = 30;
const costDecimals = 4;
export const UsagePanel = () => {
  const formId = useId();
  const [days, setDays] = useState<7 | 30 | 365>(defaultPeriod);
  const queryClient = useQueryClient();
  const usage = useQuery({
    queryKey: ['usage', days],
    queryFn: () => usageFn({ data: { days } }),
  });
  const prices = useQuery({ queryKey: ['prices'], queryFn: () => pricesFn() });
  const price = useMutation({
    mutationFn: priceFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prices'] }),
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
        USD {total.toFixed(costDecimals)} estimated · {unknown} attempts with
        unknown cost
      </p>
      <p className="mt-2 text-ink-muted text-sm">
        Estimates use the rates saved when each request starts. Provider
        invoices are authoritative. Missing usage, missing rates, and
        interrupted requests stay unknown. Tracking starts with this release.
      </p>
      {usage.isError ? (
        <Notice className="mt-4">
          Usage could not be loaded. Refresh to try again.
        </Notice>
      ) : null}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
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
      </div>
      {usage.data?.length === 0 ? (
        <p className="mt-4 text-ink-muted">
          No API requests recorded in this period.
        </p>
      ) : null}
      <details className="mt-8 border-rule border-t pt-5">
        <summary className="cursor-pointer text-lg">API prices</summary>
        <p className="mt-3 text-sm">
          Enter your provider’s USD rates per million tokens. For Vertex, text
          input includes image tokens and output includes thinking. Foundry
          image tokens use the image rates. Changes apply to future requests.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {prices.data?.map((row) => (
            <li key={row.id}>
              {row.provider} · {row.model}: input {row.inputPerMillion}, output
              {row.outputPerMillion}, image input {row.imageInputPerMillion},
              image output {row.imageOutputPerMillion}, cached input $
              {row.cachedInputPerMillion}
            </li>
          ))}
        </ul>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            price.mutate({
              data: {
                provider:
                  fields.get('provider') === 'vertex' ? 'vertex' : 'foundry',
                model: String(fields.get('model')),
                input: Number(fields.get('input')),
                output: Number(fields.get('output')),
                imageInput: Number(fields.get('imageInput')),
                imageOutput: Number(fields.get('imageOutput')),
                cachedInput: Number(fields.get('cachedInput')),
              },
            });
          }}
        >
          <label htmlFor={`${formId}-price-provider`}>
            Provider
            <select
              className={fieldClass}
              id={`${formId}-price-provider`}
              name="provider"
            >
              <option value="vertex">Vertex</option>
              <option value="foundry">Foundry</option>
            </select>
          </label>
          <label htmlFor={`${formId}-price-model`}>
            Model / deployment
            <input
              className={fieldClass}
              id={`${formId}-price-model`}
              maxLength={100}
              name="model"
              required={true}
            />
          </label>
          {rateFields.map(([name, label]) => (
            <label htmlFor={`${formId}-price-${name}`} key={name}>
              {label}
              <input
                className={fieldClass}
                id={`${formId}-price-${name}`}
                max={100_000}
                min={0}
                name={name}
                required={true}
                step="0.000001"
                type="number"
              />
            </label>
          ))}
          <div className="flex items-end">
            <button
              className={quietButtonClass}
              disabled={price.isPending}
              type="submit"
            >
              Save prices
            </button>
          </div>
        </form>
        {price.isError || prices.isError ? (
          <Notice className="mt-4" live={true}>
            Prices could not be loaded or saved. Try again.
          </Notice>
        ) : null}
        {price.isSuccess ? (
          <p className="mt-4" role="status">
            Prices saved for future requests.
          </p>
        ) : null}
      </details>
    </section>
  );
};
