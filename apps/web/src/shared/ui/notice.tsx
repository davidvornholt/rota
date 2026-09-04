import type { ReactNode } from 'react';

import { noticeClass } from './classes.ts';

type NoticeProps = {
  readonly children: ReactNode;
  /** Live for notices that appear in reaction to what the reader just did. */
  readonly live?: boolean;
  readonly className?: string;
};

/** Direction, not mood: says what happened and what to do, inside a rule. */
export const Notice = ({
  children,
  live = false,
  className = '',
}: NoticeProps) => (
  <p
    className={[noticeClass, className].join(' ')}
    role={live ? 'alert' : undefined}
  >
    {children}
  </p>
);
