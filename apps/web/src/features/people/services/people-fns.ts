import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { sessionRequired } from '#/shared/auth/auth-middleware.ts';
import { pool } from '#/shared/db/pool.ts';
import {
  issueCode,
  peopleOperation,
  requireAdmin,
  setAccess,
} from './people-service.ts';

const maxNameLength = 80;
const weekDays = 7;
const monthDays = 30;
const yearDays = 365;

export type Person = {
  id: string;
  name: string;
  enabled: boolean;
  admin: boolean;
  registered: boolean;
  lastActiveAt: string | null;
  codeExpiresAt: string | null;
};
export type UsageSummary = {
  ownerId: string;
  name: string;
  provider: string;
  model: string;
  operation: string;
  attempts: number;
  failures: number;
  unknownCosts: number;
  estimatedUsd: string;
};
export const peopleFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .handler(() =>
    peopleOperation(async () => {
      const result =
        await pool.query<Person>(`select m.id, m.name, m.enabled, m.admin,
    exists (select 1 from passkey where user_id = m.user_id) as registered,
    m.last_active_at::text as "lastActiveAt", c.expires_at::text as "codeExpiresAt"
    from member m left join access_code c on c.member_id = m.id order by m.created_at`);
      return result.rows;
    }),
  );
export const inviteFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .inputValidator(
    z.object({ name: z.string().trim().min(1).max(maxNameLength) }),
  )
  .handler(({ data }) => peopleOperation(() => issueCode(data)));
export const recoverFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .inputValidator(z.object({ memberId: z.string().min(1) }))
  .handler(({ data }) => peopleOperation(() => issueCode(data)));
export const accessFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .inputValidator(z.object({ id: z.string().min(1), enabled: z.boolean() }))
  .handler(({ data }) =>
    peopleOperation(() => setAccess(data.id, data.enabled)),
  );
export const cancelCodeFn = createServerFn({ method: 'POST' })
  .middleware([sessionRequired])
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(({ data }) =>
    peopleOperation(async () => {
      await pool.query('delete from access_code where member_id = $1', [
        data.id,
      ]);
    }),
  );
export const usageFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .inputValidator(
    z.object({
      days: z.union([
        z.literal(weekDays),
        z.literal(monthDays),
        z.literal(yearDays),
      ]),
    }),
  )
  .handler(({ data }) =>
    peopleOperation(async () => {
      const result = await pool.query<UsageSummary>(
        `select u.owner_id as "ownerId", m.name, u.provider, u.model, u.operation,
      count(*)::int as attempts, count(*) filter (where u.status <> 'success')::int as failures,
      count(*) filter (where u.estimated_usd is null)::int as "unknownCosts",
      coalesce(sum(u.estimated_usd), 0)::text as "estimatedUsd"
      from api_usage u join member m on m.id = u.owner_id
      where u.created_at >= now() - ($1 * interval '1 day')
      group by u.owner_id, m.name, u.provider, u.model, u.operation order by m.name, u.operation`,
        [data.days],
      );
      return result.rows;
    }),
  );
export type AdminGarment = {
  id: string;
  name: string;
  category: string;
  status: string;
  notes: string;
  original: string | null;
  studio: string | null;
};
export const inspectWardrobeFn = createServerFn({ method: 'GET' })
  .middleware([sessionRequired])
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(({ data }) =>
    peopleOperation(async () => {
      const actor = requireAdmin();
      const member = await pool.query<{ name: string }>(
        'select name from member where id = $1',
        [data.id],
      );
      const result = await pool.query<AdminGarment>(
        `select g.id, g.name, g.category, g.status, g.notes,
      (select storage_key from garment_image where garment_id = g.id and kind = 'original') as original,
      (select storage_key from garment_image where garment_id = g.id and kind = 'studio') as studio
      from garment g where g.owner_id = $1 order by g.created_at desc`,
        [data.id],
      );
      await pool.query(
        'insert into admin_visit (id, actor_id, member_id) values ($1,$2,$3)',
        [crypto.randomUUID(), actor.id, data.id],
      );
      return {
        name: member.rows[0]?.name ?? 'Wardrobe',
        garments: result.rows,
      };
    }),
  );
