export type StudioProgress =
  | { readonly status: 'preparing' | 'queued' | 'rendering' }
  | { readonly status: 'waiting'; readonly retryAt: number };

export type StudioState =
  | StudioProgress
  | {
      readonly status: 'idle' | 'succeeded' | 'failed';
    };

export const studioIsBusy = (state: StudioState): boolean =>
  state.status === 'preparing' ||
  state.status === 'queued' ||
  state.status === 'rendering' ||
  state.status === 'waiting';
