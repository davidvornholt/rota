import { expect, it } from 'bun:test';
import { Effect } from 'effect';
import { requestEdit } from './studio-request.ts';

it('renders at high quality without the input fidelity parameter Flare rejects', async () => {
  const result = await Effect.runPromise(
    requestEdit(
      {
        endpoint: 'http://image.invalid',
        apiKey: 'fixture',
        deployment: 'fixture',
        request: (_url, options) => {
          const form = options.body as FormData;
          expect(form.get('quality')).toBe('high');
          return Promise.resolve(
            form.has('input_fidelity')
              ? new Response('invalid_input_fidelity_model', { status: 400 })
              : Response.json({
                  data: [
                    { ...Object.fromEntries([['b64_json', 'cGljdHVyZQ==']]) },
                  ],
                }),
          );
        },
      },
      {
        photo: new Uint8Array([1]),
        mime: 'image/png',
        description: 'A shirt',
        instructions: 'Keep the white buttons.',
      },
      { transparent: true, prompt: 'A shirt' },
    ),
  );
  expect(result.mime).toBe('image/png');
});
