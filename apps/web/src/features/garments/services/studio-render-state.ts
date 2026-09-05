export type StudioRenderState = {
  readonly studioRenderId: string | null;
  readonly studioRenderCompletedId: string | null;
};

export const isCurrentStudioRender = (
  state: Pick<StudioRenderState, 'studioRenderId'>,
  renderId: string,
): boolean => state.studioRenderId === renderId;

export const isCompletedStudioRender = (
  state: Pick<StudioRenderState, 'studioRenderCompletedId'>,
  renderId: string,
): boolean => state.studioRenderCompletedId === renderId;
