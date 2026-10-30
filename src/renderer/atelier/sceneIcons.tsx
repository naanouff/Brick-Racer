/**
 * @file sceneIcons.tsx
 * @description Compact SVG glyphs for Atelier rail (collapsed + expanded).
 */

import type { ReactElement } from 'react';
import type { LevelId } from '../../racer/levels/registry';

type IconProps = { className?: string };

function Svg(props: IconProps & { children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {props.children}
    </svg>
  );
}

/** Flag / oval race. */
function RaceIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M4 20V5" />
      <path d="M4 5h10l-2 3 2 3H4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="17" r="3" />
    </Svg>
  );
}

/** City blocks. */
function CityIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M4 20V10h5v10" />
      <path d="M9 20V6h6v14" />
      <path d="M15 20v-7h5v7" />
      <path d="M6 13h1M6 16h1M11 9h1M11 12h1M11 15h1M17 15h1" />
    </Svg>
  );
}

/** Open box / sandbox. */
function SandboxIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M3 9l9-5 9 5-9 5-9-5z" />
      <path d="M3 9v7l9 5 9-5V9" />
      <path d="M12 14v7" />
    </Svg>
  );
}

/** 2×2 brick studs. */
function BrickIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <rect x="3" y="9" width="18" height="11" rx="1.5" />
      <circle cx="8" cy="7" r="2.2" />
      <circle cx="16" cy="7" r="2.2" />
    </Svg>
  );
}

/** Catalog / list. */
function CatalogIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M5 5h14v14H5z" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </Svg>
  );
}

/** Minifig silhouette. */
function MinifigIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <circle cx="12" cy="7" r="3.2" />
      <path d="M7 20v-5a5 5 0 0 1 10 0v5" />
      <path d="M9 11.5h6" />
    </Svg>
  );
}

const ICONS: Record<LevelId, (props: IconProps) => ReactElement> = {
  'race-test': RaceIcon,
  'city-test': CityIcon,
  'sandbox-kart': SandboxIcon,
  'brick-lab': BrickIcon,
  'catalog-lab': CatalogIcon,
  'minifig-lab': MinifigIcon,
};

export function SceneIcon(props: { id: LevelId; className?: string }): ReactElement {
  const Icon = ICONS[props.id];
  return <Icon className={props.className} />;
}
