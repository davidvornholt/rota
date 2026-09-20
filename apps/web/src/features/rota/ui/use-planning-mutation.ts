import { useMutation } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { OutfitEntry } from '#/shared/data/wear-log-repository.ts';
import { serverFunctionFetch } from '#/shared/runtime/server-function-fetch.ts';
import type { PlanningChange } from '../schemas/planning-input.ts';
import type { PlanningView } from '../schemas/planning-view.ts';
import type { SuggestionJob } from '../schemas/suggestion-job.ts';
import { changePlanningFn } from '../services/planning-fns.ts';
import { recoverSuggestion, runSuggestion } from './suggestion-client.ts';

type PlanningOperation =
  | PlanningChange
  | { readonly action: 'resume-suggestion'; readonly job: SuggestionJob };

const successMessage = (change: PlanningOperation): string => {
  switch (change.action) {
    case 'resume-suggestion':
    case 'suggest':
      return 'Outfit suggested. Your kept pieces stay.';
    case 'plan':
      return '';
    case 'wear':
      return 'Outfit logged.';
    case 'save-outfit':
      return 'Saved to your outfits.';
    case 'care':
      if (change.care === 'laundry') {
        return 'Sent to laundry.';
      }
      return change.care === 'washed' ? 'Back clean.' : 'Return date updated.';
    default:
      return 'Saved.';
  }
};

export const usePlanningMutation = ({
  view,
  seed,
  setView,
  setEntries,
  setBasedOn,
  setPinned,
  setMessage,
}: {
  readonly view: PlanningView;
  readonly seed: {
    readonly garment: string | undefined;
    readonly outfit: string | undefined;
  };
  readonly setView: Dispatch<SetStateAction<PlanningView>>;
  readonly setEntries: Dispatch<SetStateAction<ReadonlyArray<OutfitEntry>>>;
  readonly setBasedOn: Dispatch<SetStateAction<string | null>>;
  readonly setPinned: Dispatch<SetStateAction<ReadonlyArray<string>>>;
  readonly setMessage: Dispatch<SetStateAction<string>>;
}) => {
  const router = useRouter();
  const mutationScopeId = useId();
  const startedRef = useRef(false);
  const [recovering, setRecovering] = useState(true);
  const requestRef = useRef(new AbortController());
  const mutation = useMutation({
    scope: { id: mutationScopeId },
    mutationFn: (change: PlanningOperation) => {
      startedRef.current = true;
      if (
        change.action === 'suggest' ||
        change.action === 'resume-suggestion'
      ) {
        setMessage(
          'Choosing an outfit … this may take a few minutes. You can leave this page and come back.',
        );
        return runSuggestion(
          view.day.today,
          change.action === 'suggest' ? change.entries : [],
          change.action === 'resume-suggestion' ? change.job : undefined,
          requestRef.current.signal,
        );
      }
      return changePlanningFn({
        data: { date: view.day.today, change },
        fetch: serverFunctionFetch,
      });
    },
    onError: () => setMessage(''),
    onSuccess: async (next, change) => {
      setView(next);
      if (
        change.action === 'suggest' ||
        change.action === 'resume-suggestion'
      ) {
        setBasedOn(next.plan.basedOn);
        setEntries(
          next.day.worn?.map((item) => ({
            slot: item.slot,
            garmentId: item.garment.id,
          })) ??
            next.plan.entries ??
            next.day.proposal?.items.map((item) => ({
              slot: item.slot,
              garmentId: item.garment.id,
            })) ??
            [],
        );
      }
      if (
        change.action === 'care' &&
        change.care === 'laundry' &&
        next.day.worn === null
      ) {
        setEntries((current) =>
          current.filter((entry) => !change.ids.includes(entry.garmentId)),
        );
        setPinned((current) =>
          current.filter((id) => !change.ids.includes(id)),
        );
      }
      setMessage(successMessage(change));
      try {
        const savedDay =
          change.action === 'plan' ||
          change.action === 'suggest' ||
          change.action === 'resume-suggestion' ||
          change.action === 'wear' ||
          (change.action === 'care' && change.draft !== null);
        if (
          savedDay &&
          (seed.garment !== undefined || seed.outfit !== undefined)
        ) {
          // A consumed seed must not remount from an older cached outfit.
          router.clearCache({ filter: (match) => match.pathname === '/' });
          await router.navigate({
            to: '/',
            search: { date: next.day.today },
            replace: true,
            resetScroll: false,
            ignoreBlocker: true,
          });
        } else {
          await router.invalidate({ sync: true });
        }
      } catch {
        setMessage('Saved. Refresh to see your outfit.');
      }
    },
  });
  const resumeRef = useRef(mutation.mutate);
  resumeRef.current = mutation.mutate;
  useEffect(() => {
    const abort = new AbortController();
    requestRef.current = abort;
    recoverSuggestion(view.day.today, abort.signal)
      .then((job) => {
        if (job !== null && !startedRef.current && !abort.signal.aborted) {
          resumeRef.current({ action: 'resume-suggestion', job });
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setMessage(
            'Could not check for an ongoing suggestion. Refresh to reconnect.',
          );
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) {
          setRecovering(false);
        }
      });
    return () => abort.abort();
  }, [view.day.today, setMessage]);
  return { ...mutation, recovering };
};
