/**
 * @file sceneIcons.tsx
 * @description Lucide icons for Atelier rail (LT3).
 */

import type { ReactElement } from 'react';
import {
  Box,
  Building2,
  Flag,
  LayoutGrid,
  Package,
  UserRound,
  type LucideProps,
} from 'lucide-react';
import type { LevelId } from '../../racer/levels/registry';

const ICON_PROPS: LucideProps = {
  size: 18,
  strokeWidth: 2,
  'aria-hidden': true,
};

const ICONS: Record<LevelId, (props: { className?: string }) => ReactElement> = {
  'race-test': (p) => <Flag {...ICON_PROPS} className={p.className} />,
  'city-test': (p) => <Building2 {...ICON_PROPS} className={p.className} />,
  'sandbox-kart': (p) => <Box {...ICON_PROPS} className={p.className} />,
  'brick-lab': (p) => <Package {...ICON_PROPS} className={p.className} />,
  'catalog-lab': (p) => <LayoutGrid {...ICON_PROPS} className={p.className} />,
  'minifig-lab': (p) => <UserRound {...ICON_PROPS} className={p.className} />,
};

export function SceneIcon(props: { id: LevelId; className?: string }): ReactElement {
  const Icon = ICONS[props.id];
  return <Icon className={props.className} />;
}
