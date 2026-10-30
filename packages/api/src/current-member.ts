import { Context } from 'effect';

/** The household member a request acts for. */
export type Member = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly admin: boolean;
};

export class CurrentMember extends Context.Service<CurrentMember, Member>()(
  '@rota/api/CurrentMember',
) {}
