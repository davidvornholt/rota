import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { type Intake, intakeOf } from './photo-intake.ts';

/** Inputs that take typed text, where a paste of text belongs to the field. */
const textInputTypes = new Set([
  'email',
  'number',
  'password',
  'search',
  'tel',
  'text',
  'url',
]);

const takesText = (target: EventTarget | null) =>
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLInputElement && textInputTypes.has(target.type)) ||
  (target instanceof HTMLElement && target.isContentEditable);

/** An open dialog owns the keyboard and the pointer; nothing joins behind it. */
const dialogOpen = () => document.querySelector('dialog[open]') !== null;

/** Files from outside the page, or a link that may point at a picture. */
const carriesPictures = (event: DragEvent) => {
  const types = event.dataTransfer?.types ?? [];
  return types.includes('Files') || types.includes('text/uri-list');
};

const skippedWords = (count: number) =>
  count === 1
    ? '1 file was not a picture and was left out.'
    : `${count} files were not pictures and were left out.`;

/** A sentence about the last paste or drop; a new one replaces it, even if it reads the same. */
export type IntakeNotice = { readonly id: number; readonly message: string };

/**
 * Paste and drop anywhere on the page. A paste into a text field stays the
 * field's when it carries text; a drag of something from this page is not an
 * upload. While files are dragged over the window, `dragging` is true.
 */
export const usePhotoIntake = ({
  onPictures,
}: {
  readonly onPictures: (files: ReadonlyArray<File>) => void;
}) => {
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<IntakeNotice | null>(null);
  const noticeCountRef = useRef(0);

  const say = (message: string | null) => {
    noticeCountRef.current += 1;
    setNotice(
      message === null ? null : { id: noticeCountRef.current, message },
    );
  };

  const take = (intake: Intake) => {
    if (intake.kind === 'nothing') {
      return;
    }
    if (intake.kind === 'refused') {
      say(intake.message);
      return;
    }
    say(intake.skipped === 0 ? null : skippedWords(intake.skipped));
    onPictures(intake.files);
  };
  const takeFromListener = useEffectEvent(take);

  useEffect(() => {
    let depth = 0;
    let dragFromPage = false;
    const leave = () => {
      depth = 0;
      setDragging(false);
    };
    const onPaste = (event: ClipboardEvent) => {
      const data = event.clipboardData;
      if (data === null || event.defaultPrevented || dialogOpen()) {
        return;
      }
      if (takesText(event.target) && data.types.includes('text/plain')) {
        return;
      }
      const intake = intakeOf(data);
      if (intake.kind !== 'nothing') {
        event.preventDefault();
        takeFromListener(intake);
      }
    };
    const onDragStart = () => {
      dragFromPage = true;
    };
    const onDragEnd = () => {
      dragFromPage = false;
    };
    const onDragEnter = (event: DragEvent) => {
      if (dragFromPage || !carriesPictures(event)) {
        return;
      }
      event.preventDefault();
      depth += 1;
      setDragging(!dialogOpen());
    };
    const onDragOver = (event: DragEvent) => {
      if (dragFromPage || !carriesPictures(event)) {
        return;
      }
      // Without this the browser opens the dropped file in place of the page.
      event.preventDefault();
      if (event.dataTransfer !== null) {
        event.dataTransfer.dropEffect = dialogOpen() ? 'none' : 'copy';
      }
    };
    // Counted whatever it carries, so a drag that ends off the page never
    // leaves the overlay behind.
    const onDragLeave = () => {
      if (depth === 0) {
        return;
      }
      depth -= 1;
      if (depth <= 0) {
        leave();
      }
    };
    const onDrop = (event: DragEvent) => {
      if (dragFromPage || !carriesPictures(event)) {
        return;
      }
      event.preventDefault();
      leave();
      if (event.dataTransfer !== null && !dialogOpen()) {
        takeFromListener(intakeOf(event.dataTransfer));
      }
    };
    const listeners = [
      ['paste', onPaste],
      ['dragstart', onDragStart],
      ['dragend', onDragEnd],
      ['dragenter', onDragEnter],
      ['dragover', onDragOver],
      ['dragleave', onDragLeave],
      ['drop', onDrop],
    ] as const;
    for (const [type, listener] of listeners) {
      globalThis.addEventListener(type, listener as EventListener);
    }
    return () => {
      for (const [type, listener] of listeners) {
        globalThis.removeEventListener(type, listener as EventListener);
      }
    };
  }, []);

  return { dragging, notice, take, dismiss: () => say(null) };
};
