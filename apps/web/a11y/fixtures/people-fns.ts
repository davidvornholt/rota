import { Effect } from 'effect';
import type {
  Person,
  UsageSummary,
} from '#/features/people/services/people-fns.ts';

import { usageFn as demoUsageFn } from './usage-fns.ts';

const people: Array<Person> = [
  {
    id: 'alex',
    name: 'Alex',
    enabled: true,
    admin: true,
    registered: true,
    lastActiveAt: null,
    codeExpiresAt: null,
  },
  {
    id: 'sam',
    name: 'Sam',
    enabled: true,
    admin: true,
    registered: true,
    lastActiveAt: null,
    codeExpiresAt: null,
  },
  {
    id: 'jordan',
    name: 'Jordan',
    enabled: true,
    admin: false,
    registered: true,
    lastActiveAt: null,
    codeExpiresAt: null,
  },
];

export const peopleFn = () => Effect.runPromise(Effect.succeed(people));
export const usageFn = () =>
  globalThis.location.pathname.endsWith('/usage.html')
    ? demoUsageFn()
    : Effect.runPromise(Effect.succeed<Array<UsageSummary>>([]));
export const accessFn = () => Effect.runPromise(Effect.void);
export const cancelCodeFn = () => Effect.runPromise(Effect.void);
export const inviteFn = () =>
  Effect.runPromise(Effect.succeed({ code: 'fixture-code' }));
export const recoverFn = inviteFn;
