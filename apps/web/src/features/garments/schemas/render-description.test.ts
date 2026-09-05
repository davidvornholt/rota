import { expect, it } from 'bun:test';
import { studioPrompt } from '#/shared/ai/studio-prompt.ts';
import { renderDescription } from './render-description.ts';

it('passes colour corrections and instructions to the studio prompt', () => {
  const description = renderDescription({
    name: 'Blue Oxford shirt',
    colors: [
      { name: 'Navy', hex: '#112233' },
      { name: '', hex: '#ffffff' },
    ],
    material: 'Cotton',
    pattern: 'striped',
  });
  const prompt = studioPrompt({
    description,
    instructions: '  Keep the white buttons.  ',
  });
  expect(prompt).toContain('Navy (#112233)');
  expect(prompt).toContain('#ffffff');
  expect(prompt).toContain('Cotton');
  expect(prompt).toContain('striped');
  expect(prompt).toContain(
    'Additional corrections from the owner: Keep the white buttons.',
  );
  expect(prompt).toContain('Hex values specify the target colours');
});

it('omits custom corrections when instructions are blank', () => {
  expect(
    studioPrompt({ description: 'A shirt', instructions: '  ' }),
  ).not.toContain('Additional corrections');
});
