import { useEffect, useRef } from 'react';

import { IconButton } from '#/shared/ui/icon-button.tsx';
import { Notice } from '#/shared/ui/notice.tsx';
import type { IntakeNotice } from './use-photo-intake.ts';

/**
 * What became of the last paste or drop when it was not a picture. It sits
 * under the page heading, comes into view if the page was scrolled away, and
 * stays until it is dismissed or the next picture arrives.
 */
export const IntakeNoticeRow = ({
  notice,
  onDismiss,
}: {
  readonly notice: IntakeNotice;
  readonly onDismiss: () => void;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  return (
    <div
      className="mt-4 flex max-w-2xl items-start gap-2 motion-safe:animate-soft-reveal"
      ref={rowRef}
    >
      <Notice className="flex-1" live={true}>
        {notice.message}
      </Notice>
      <IconButton icon="close" label="Dismiss" onClick={onDismiss} />
    </div>
  );
};
