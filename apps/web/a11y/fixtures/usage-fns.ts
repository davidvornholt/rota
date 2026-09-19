export const usageFn = () =>
  Promise.resolve([
    {
      ownerId: 'demo',
      name: 'Alex',
      provider: 'vertex',
      model: 'gemini-3.8-flash',
      operation: 'Outfit suggestion',
      attempts: 3,
      failures: 0,
      unknownCosts: 0,
      estimatedUsd: '0.0034',
    },
  ]);
