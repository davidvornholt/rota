import { describe, expect, it } from 'bun:test';
import {
  isCompletedStudioRender,
  isCurrentStudioRender,
} from './studio-render-state.ts';

describe('studio render identity', () => {
  const first = '11111111-1111-4111-8111-111111111111';
  const second = '22222222-2222-4222-8222-222222222222';

  it('recognizes completion even when the image URL is unchanged', () => {
    const state = {
      studioRenderId: first,
      studioRenderCompletedId: first,
      studioUrl: '/api/media/same-content.png',
    };

    expect(isCompletedStudioRender(state, first)).toBe(true);
  });

  it('rejects a render after a newer request takes ownership', () => {
    const state = {
      studioRenderId: second,
      studioRenderCompletedId: null,
    };

    expect(isCurrentStudioRender(state, first)).toBe(false);
    expect(isCompletedStudioRender(state, first)).toBe(false);
  });
});
