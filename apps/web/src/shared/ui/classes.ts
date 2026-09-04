/**
 * The shape vocabulary every page shares. Colour comes from the theme tokens in
 * styles.css; these recipes only arrange it, so a page cannot drift from the
 * next by retyping a frame or a button.
 */

/** One frame for the masthead and every page, so they start on the same line. */
export const frameClass = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

export const proseClass = 'max-w-prose';

const controlBase =
  'inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-medium tracking-wide transition-colors duration-150 ease-standard disabled:cursor-not-allowed disabled:opacity-50';

/** The one yellow thing on a page: the action the page exists for. */
export const signalButtonClass = `${controlBase} bg-signal text-ink hover:bg-signal-deep`;

export const inkButtonClass = `${controlBase} bg-ink text-paper hover:bg-ink-muted`;

export const quietButtonClass = `${controlBase} border border-rule-strong bg-transparent text-ink hover:border-ink`;

/** A text-weight action: a rule under it is what tells it apart from a sentence. */
export const linkButtonClass =
  'inline-flex min-h-11 items-center text-ink text-sm underline decoration-rule-strong underline-offset-4 hover:decoration-ink';

export const fieldClass =
  'block w-full border border-rule-strong bg-paper px-3 py-2.5 text-base text-ink placeholder:text-ink-faint hover:border-ink-muted focus:border-ink focus:outline-none';

export const labelClass = 'type-eyebrow block';

export const checkClass =
  'size-5 appearance-none border border-rule-strong bg-paper checked:border-ink checked:bg-ink';

/** A notice sits inside a rule, never a filled colour box. */
export const noticeClass =
  'border border-ink px-4 py-3 text-ink text-sm leading-relaxed';

export const tabClass =
  'relative inline-flex min-h-11 items-center px-1 type-eyebrow text-ink-muted transition-colors hover:text-ink';

export const tabActiveClass =
  'text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-signal';

export const hairlineRowClass = 'border-rule border-t';
