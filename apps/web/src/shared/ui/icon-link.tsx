import type { LinkProps } from '@tanstack/react-router';
import { type ActionIcon, IconButton } from './icon-button.tsx';

export const IconLink = ({
  icon,
  label,
  linkOptions,
}: {
  readonly icon: ActionIcon;
  readonly label: string;
  readonly linkOptions: LinkProps;
}) => <IconButton icon={icon} label={label} linkOptions={linkOptions} />;
