export const usageFn = () =>
  Promise.resolve([
    {
      ownerId: 'demo',
      name: 'Alex',
      provider: 'bedrock',
      model: 'global.anthropic.claude-sonnet-5-5',
      operation: 'Outfit suggestion',
      attempts: 3,
      failures: 0,
      unknownCosts: 0,
      estimatedUsd: '0.0034',
    },
  ]);
