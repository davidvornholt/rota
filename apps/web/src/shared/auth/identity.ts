// biome-ignore lint/correctness/noNodejsModules: Request identity exists only on the Bun/Node server, before entering an Effect runtime.
import { AsyncLocalStorage } from 'node:async_hooks';
import { Context } from 'effect';
import { IdentityRequired } from './identity-error.ts';

export type Identity = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly admin: boolean;
};
const requestIdentity = new AsyncLocalStorage<Identity>();
export const asIdentity = <A>(identity: Identity, work: () => A): A =>
  requestIdentity.run(identity, work);
export const currentIdentity = (): Identity => {
  const identity = requestIdentity.getStore();
  if (!identity) {
    throw new IdentityRequired({ message: 'Sign in to access your wardrobe.' });
  }
  return identity;
};
export class WardrobeOwner extends Context.Tag('shared/WardrobeOwner')<
  WardrobeOwner,
  Identity
>() {}
