import { Effect } from 'effect';

export const currentPersonFn = () =>
  Effect.runPromise(
    Effect.succeed({
      id: 'alex',
      userId: 'alex-user',
      name: 'Alex',
      admin: true,
    }),
  );
