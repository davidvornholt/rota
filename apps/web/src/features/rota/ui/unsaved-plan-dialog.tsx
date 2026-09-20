import { linkButtonClass, signalButtonClass } from '#/shared/ui/classes.ts';
import { Dialog } from '#/shared/ui/dialog.tsx';
import type { PlanningController } from './use-planning.ts';

export const UnsavedPlanDialog = ({
  controller,
}: {
  readonly controller: PlanningController;
}) => {
  const { blocker } = controller.planSave;
  if (blocker.status !== 'blocked') {
    return null;
  }
  return (
    <Dialog open={true} onClose={blocker.reset} title="Leave without saving?">
      <p>
        Your latest outfit changes could not be saved. Stay here to retry, or
        leave and discard those changes.
      </p>
      <div className="mt-5 flex flex-wrap gap-4">
        <button
          className={signalButtonClass}
          onClick={blocker.reset}
          type="button"
        >
          Stay here
        </button>
        <button
          className={linkButtonClass}
          onClick={blocker.proceed}
          type="button"
        >
          Leave without saving
        </button>
      </div>
    </Dialog>
  );
};
