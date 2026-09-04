import { SqlClient } from '@effect/sql';
import { Effect, Schema } from 'effect';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { notFound, readError, writeError } from './errors/data-errors.ts';
import { SlotSchema } from './garment.ts';

export const ProposalStatusSchema = Schema.Literal(
  'pending',
  'confirmed',
  'rejected',
  'superseded',
);
export type ProposalStatus = Schema.Schema.Type<typeof ProposalStatusSchema>;

export const ProposalItemSchema = Schema.Struct({
  garmentId: Schema.UUID,
  slot: SlotSchema,
  /** True when the engine carried the garment over from yesterday. */
  continued: Schema.Boolean,
  /** Which day of its wear budget today is, counting today. */
  dayOfBudget: Schema.Number,
  budget: Schema.Number,
  reason: Schema.String,
});
export type ProposalItem = Schema.Schema.Type<typeof ProposalItemSchema>;

export const ProposalPayloadSchema = Schema.Struct({
  items: Schema.Array(ProposalItemSchema),
  /** The one line the morning opens with, in the app's voice. */
  headline: Schema.String,
  /** Garments this proposal was told not to use (today's rejections). */
  excludedGarmentIds: Schema.Array(Schema.UUID),
  forecastStale: Schema.Boolean,
  occasion: Schema.NullOr(Schema.String),
});
export type ProposalPayload = Schema.Schema.Type<typeof ProposalPayloadSchema>;

export const ProposalFromRow = Schema.Struct({
  id: Schema.UUID,
  forDate: Schema.propertySignature(LocalDateSchema).pipe(
    Schema.fromKey('for_date'),
  ),
  status: ProposalStatusSchema,
  payload: ProposalPayloadSchema,
  reason: Schema.String,
  model: Schema.String,
  createdAt: Schema.propertySignature(Schema.ValidDateFromSelf).pipe(
    Schema.fromKey('created_at'),
  ),
  decidedAt: Schema.propertySignature(
    Schema.NullOr(Schema.ValidDateFromSelf),
  ).pipe(Schema.fromKey('decided_at')),
});
export type Proposal = Schema.Schema.Type<typeof ProposalFromRow>;

const decodeProposals = Schema.decodeUnknown(Schema.Array(ProposalFromRow));
const readProposal = readError('The proposal');
const writeProposal = writeError('The proposal');

export class ProposalRepository extends Effect.Service<ProposalRepository>()(
  'shared/ProposalRepository',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const listForDate = (date: LocalDate) =>
        sql`
          select id, for_date, status, payload, reason, model, created_at, decided_at
          from proposal
          where for_date = ${date}
          order by created_at desc
        `.pipe(Effect.flatMap(decodeProposals), Effect.mapError(readProposal));

      const latestForDate = (date: LocalDate) =>
        listForDate(date).pipe(Effect.map((rows) => rows[0]));

      const byId = (id: string) =>
        sql`
          select id, for_date, status, payload, reason, model, created_at, decided_at
          from proposal where id = ${id}
        `.pipe(
          Effect.flatMap(decodeProposals),
          Effect.mapError(readProposal),
          Effect.flatMap((rows) => {
            const [row] = rows;
            return row === undefined
              ? Effect.fail(notFound('The proposal'))
              : Effect.succeed(row);
          }),
        );

      /**
       * A new proposal for a day retires any pending one for the same day, so
       * the day has exactly one open proposal at a time.
       */
      const insert = (
        date: LocalDate,
        payload: ProposalPayload,
        reason: string,
        model: string,
      ) =>
        sql
          .withTransaction(
            Effect.gen(function* () {
              yield* sql`
                update proposal set status = 'superseded', decided_at = now()
                where for_date = ${date} and status = 'pending'
              `;
              const rows = yield* sql`
                insert into proposal (for_date, payload, reason, model)
                values (${date}, ${JSON.stringify(payload)}::jsonb, ${reason}, ${model})
                returning id, for_date, status, payload, reason, model, created_at, decided_at
              `;
              return rows;
            }),
          )
          .pipe(
            Effect.flatMap(decodeProposals),
            Effect.mapError(writeProposal),
            Effect.flatMap((rows) => {
              const [row] = rows;
              return row === undefined
                ? Effect.fail(writeProposal(new Error('No row returned.')))
                : Effect.succeed(row);
            }),
          );

      const setStatus = (id: string, status: ProposalStatus) =>
        sql`
          update proposal set status = ${status}, decided_at = now()
          where id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(writeProposal));

      /** Every proposal ever made, newest first; the statistics read this once. */
      const history = () =>
        sql`
          select id, for_date, status, payload, reason, model, created_at, decided_at
          from proposal
          order by for_date desc, created_at desc
        `.pipe(Effect.flatMap(decodeProposals), Effect.mapError(readProposal));

      return { listForDate, latestForDate, byId, insert, setStatus, history };
    }),
  },
) {}
