import { createFileRoute, Outlet } from '@tanstack/react-router';
import { peopleFn } from '#/features/people/services/people-fns.ts';
export const Route = createFileRoute('/_app/people')({
  beforeLoad: () => peopleFn(),
  component: Outlet,
});
