// biome-ignore-all lint/suspicious/noMisplacedAssertion: This helper belongs to the executable planning database smoke check, which uses node:assert.
import assert from 'node:assert/strict';
import { SqlClient } from '@effect/sql';
import { Effect } from 'effect';
import { changePlanning } from '#/features/rota/services/planning-service.ts';
import { OutfitRepository } from '#/shared/data/outfit-repository.ts';
import { ProposalRepository } from '#/shared/data/proposal-repository.ts';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import type { WardrobeClock } from '#/shared/time/wardrobe-clock.ts';

/** Fail PostgreSQL writes after insertion, including retirement of the old proposal. */
export const verifySuggestionRollback = (
  clock: WardrobeClock,
  pinned: ReadonlyArray<OutfitEntry>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const outfits = yield* OutfitRepository;
    const proposals = yield* ProposalRepository;
    const previousPlan = yield* outfits.plan(clock.today);
    const previousProposal = yield* proposals.latestForDate(clock.today);
    assert(previousProposal !== undefined);
    for (const target of ['plan', 'rejection']) {
      yield* target === 'plan'
        ? sql`create function fail_test_write() returns trigger language plpgsql as $$
            begin raise exception 'Injected daily plan write failure'; end;
          $$`
        : sql`create function fail_test_write() returns trigger language plpgsql as $$
            begin
              if new.status = 'rejected' then raise exception 'Injected rejection failure'; end if;
              return new;
            end;
          $$`;
      yield* target === 'plan'
        ? sql`create trigger fail_test_write before insert or update on day_plan
            for each row execute function fail_test_write()`
        : sql`create trigger fail_test_write before update on proposal
            for each row execute function fail_test_write()`;
      const dropTrigger =
        target === 'plan'
          ? sql`drop trigger fail_test_write on day_plan`
          : sql`drop trigger fail_test_write on proposal`;
      const result = yield* Effect.either(
        changePlanning(clock, {
          action: 'suggest',
          entries: pinned,
          basedOn: null,
        }),
      ).pipe(
        Effect.ensuring(
          dropTrigger.pipe(
            Effect.zipRight(sql`drop function fail_test_write()`),
            Effect.orDie,
          ),
        ),
      );
      assert.equal(result._tag, 'Left');
      assert.deepEqual(
        yield* outfits.plan(clock.today),
        previousPlan,
        `A failed ${target} write preserves the previous dated plan.`,
      );
      assert.deepEqual(
        yield* proposals.latestForDate(clock.today),
        previousProposal,
        `A failed ${target} write rolls back the new proposal too.`,
      );
    }
    yield* changePlanning(clock, {
      action: 'suggest',
      entries: pinned,
      basedOn: null,
    });
    assert.equal(
      (yield* proposals.byId(previousProposal.id)).status,
      'rejected',
      'A successful replacement retires its previous proposal.',
    );
    const next = yield* proposals.latestForDate(clock.today);
    assert.notEqual(next?.id, previousProposal.id);
    assert.deepEqual(
      (yield* outfits.plan(clock.today)).entries,
      next?.payload.items.map(({ garmentId, slot }) => ({ garmentId, slot })),
      'Successful generation commits proposal and dated plan together.',
    );
  });
