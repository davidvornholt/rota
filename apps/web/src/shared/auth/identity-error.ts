import { Data } from 'effect';
export class IdentityRequired extends Data.TaggedError('IdentityRequired')<{
  readonly message: string;
}> {}
