// Gives a create form the ID of one form fill, chosen before the first save.
// The server stores it with what it creates, so it can tell a repeated save
// (for example after a lost answer) from a new one. The ID stays the same
// while the form is saved with unchanged values. Changed values are a new
// fill, so a correction is never swallowed as a repeat of the old input.
export const createSubmissionIds = (
  createId: () => string = () => crypto.randomUUID(),
) => {
  let current: { readonly key: string; readonly id: string } | null = null;

  return {
    idFor: (values: unknown): string => {
      const key = JSON.stringify(values);
      if (current?.key !== key) {
        current = { key, id: createId() };
      }
      return current.id;
    },
    // A later save with identical values is a new fill.
    settle: (): void => {
      current = null;
    },
  };
};
