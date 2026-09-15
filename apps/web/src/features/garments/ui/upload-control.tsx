import { useState } from 'react';

import { quietButtonClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { Notice } from '#/shared/ui/notice.tsx';
import { uploadEndpoint, uploadFieldName } from '../upload-contract.ts';
import { downscaleForUpload } from './downscale-image.ts';
import { PhotoPicker } from './photo-picker.tsx';

type UploadState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing'; readonly count: number }
  | { readonly kind: 'uploading'; readonly count: number }
  | { readonly kind: 'failed'; readonly message: string };

type UploadControlProps = {
  readonly onUploaded: (count: number) => void;
};

/**
 * Two ways in: the camera, for standing at the wardrobe, and the photo
 * library, for a batch. Either way the photos are shrunk on the device and sent
 * together; the cards appear in the queue the moment the server has them.
 */
export const UploadControl = ({ onUploaded }: UploadControlProps) => {
  const [state, setState] = useState<UploadState>({ kind: 'idle' });

  const send = async (files: ReadonlyArray<File>) => {
    if (files.length === 0) {
      return;
    }
    setState({ kind: 'preparing', count: files.length });
    try {
      const prepared = await Promise.all(files.map(downscaleForUpload));
      setState({ kind: 'uploading', count: files.length });
      const form = new FormData();
      for (const file of prepared) {
        form.append(uploadFieldName, file, file.name);
      }
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: form,
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          message === '' ? `Upload failed (${response.status}).` : message,
        );
      }
      setState({ kind: 'idle' });
      onUploaded(files.length);
    } catch (error) {
      setState({
        kind: 'failed',
        message:
          error instanceof Error
            ? error.message
            : 'The upload did not go through.',
      });
    }
  };

  const busy = state.kind === 'preparing' || state.kind === 'uploading';
  const photos = (count: number) => `${count} photo${count === 1 ? '' : 's'}`;
  let status: string | null = null;
  if (state.kind === 'preparing') {
    status = `Preparing ${photos(state.count)} …`;
  } else if (state.kind === 'uploading') {
    status = `Sending ${photos(state.count)} …`;
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <PhotoPicker
          busy={busy}
          camera={true}
          className={signalButtonClass}
          label="Photograph a garment"
          onPick={send}
        />
        <PhotoPicker
          busy={busy}
          className={quietButtonClass}
          label="Choose photos"
          multiple={true}
          onPick={send}
        />
      </div>
      {status === null ? null : (
        <p className="mt-3 text-ink-muted text-sm" role="status">
          {status}
        </p>
      )}
      {state.kind === 'failed' ? (
        <Notice className="mt-3" live={true}>
          {state.message}
        </Notice>
      ) : null}
    </div>
  );
};
