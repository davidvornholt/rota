import { Context, Effect, Layer, Schema } from 'effect';
import { SqlClient } from 'effect/sql';
import { WardrobeOwner } from '#/shared/auth/identity.ts';
import { UuidSchema } from '#/shared/data/uuid-schema.ts';
import type { LocalDate } from '#/shared/time/local-date.ts';
import { LocalDateSchema } from '#/shared/time/local-date-schema.ts';
import { notFound, readError, writeError } from './errors/data-errors.ts';
import { SlotSchema } from './garment.ts';

export const ProposalStatusSchema = Schema.Literals([
  'pending',
  'confirmed',
  'rejected',
  'superseded',
]);
export type ProposalStatus = Schema.Schema.Type<typeof ProposalStatusSchema>;

export const ProposalItemSchema = Schema.Struct({
  garmentId: UuidSchema,
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
  excludedGarmentIds: Schema.Array(UuidSchema),
  forecastStale: Schema.Boolean,
  occasion: Schema.NullOr(Schema.String),
});
export type ProposalPayload = Schema.Schema.Type<typeof ProposalPayloadSchema>;

export const ProposalFromRow = Schema.Struct({
  id: UuidSchema,
  forDate: LocalDateSchema,
  status: ProposalStatusSchema,
  payload: ProposalPayloadSchema,
  reason: Schema.String,
  model: Schema.String,
  createdAt: Schema.Date,
  decidedAt: Schema.NullOr(Schema.Date),
}).pipe(
  Schema.encodeKeys({
    forDate: 'for_date',
    createdAt: 'created_at',
    decidedAt: 'decided_at',
  }),
);
export type Proposal = Schema.Schema.Type<typeof ProposalFromRow>;

/** The scheduler's failed attempts at the proposal for `forDate`. */
const ScheduledFailuresFromRow = Schema.Struct({
  forDate: LocalDateSchema,
  failures: Schema.Number,
  lastFailedAt: Schema.Date,
}).pipe(
  Schema.encodeKeys({
    forDate: 'for_date',
    lastFailedAt: 'last_failed_at',
  }),
);
export type ScheduledFailures = Schema.Schema.Type<
  typeof ScheduledFailuresFromRow
>;

const decodeProposals = Schema.decodeUnknownEffect(
  Schema.Array(ProposalFromRow),
);
const decodeScheduledFailures = Schema.decodeUnknownEffect(
  Schema.Array(ScheduledFailuresFromRow),
);
const readProposal = readError('The proposal');
const writeProposal = writeError('The proposal');

export class ProposalRepository extends Context.Service<ProposalRepository>()(
  'shared/ProposalRepository',
  {
    make: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const owner = yield* WardrobeOwner;

      const listForDate = (date: LocalDate) =>
        sql`
          select id, for_date, status, payload, reason, model, created_at, decided_at
          from proposal
          where owner_id = ${owner.id} and for_date = ${date}
          order by created_at desc
        `.pipe(Effect.flatMap(decodeProposals), Effect.mapError(readProposal));

      const latestForDate = (date: LocalDate) =>
        listForDate(date).pipe(
          Effect.map((rows): Proposal | undefined => rows[0]),
        );

      const byId = (id: string) =>
        sql`
          select id, for_date, status, payload, reason, model, created_at, decided_at
          from proposal where owner_id = ${owner.id} and id = ${id}
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
                where owner_id = ${owner.id} and for_date = ${date} and status = 'pending'
              `;
              const rows = yield* sql`
                insert into proposal (owner_id, for_date, payload, reason, model)
                values (${owner.id}, ${date}, ${JSON.stringify(payload)}::jsonb, ${reason}, ${model})
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
          where owner_id = ${owner.id} and id = ${id}
        `.pipe(Effect.asVoid, Effect.mapError(writeProposal));

      /** Every proposal ever made, newest first; the statistics read this once. */
      const history = () =>
        sql`
          select id, for_date, status, payload, reason, model, created_at, decided_at
          from proposal
          where owner_id = ${owner.id}
          order by for_date desc, created_at desc
        `.pipe(Effect.flatMap(decodeProposals), Effect.mapError(readProposal));

      /** The wardrobe's one backoff row, for whichever day the scheduler last failed on. */
      const scheduledFailures = () =>
        sql`
          select for_date, failures, last_failed_at
          from proposal_backoff where owner_id = ${owner.id}
        `.pipe(
          Effect.flatMap(decodeScheduledFailures),
          Effect.map((rows): ScheduledFailures | undefined => rows[0]),
          Effect.mapError(readProposal),
        );

      const saveScheduledFailures = (state: ScheduledFailures) =>
        sql`
          insert into proposal_backoff (owner_id, for_date, failures, last_failed_at)
          values (${owner.id}, ${state.forDate}, ${state.failures}, ${state.lastFailedAt})
          on conflict (owner_id) do update set
            for_date = excluded.for_date,
            failures = excluded.failures,
            last_failed_at = excluded.last_failed_at
        `.pipe(Effect.asVoid, Effect.mapError(writeProposal));

      const clearScheduledFailures = (date: LocalDate) =>
        sql`
          delete from proposal_backoff where owner_id = ${owner.id} and for_date = ${date}
        `.pipe(Effect.asVoid, Effect.mapError(writeProposal));

      return {
        listForDate,
        latestForDate,
        byId,
        insert,
        setStatus,
        history,
        scheduledFailures,
        saveScheduledFailures,
        clearScheduledFailures,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(
    ProposalRepository,
    ProposalRepository.make,
  );
}
