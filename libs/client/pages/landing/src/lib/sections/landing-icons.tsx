import type { JSX, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function baseProps(props: IconProps): IconProps {
  const { fill = 'none', ...rest } = props;
  return {
    fill,
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 2,
    viewBox: '0 0 24 24',
    ...rest,
  };
}

export function AtomIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <circle
        cx="12"
        cy="12"
        r="1.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.5"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.5"
        transform="rotate(60 12 12)"
      />
      <ellipse
        cx="12"
        cy="12"
        rx="9"
        ry="3.5"
        transform="rotate(120 12 12)"
      />
    </svg>
  );
}

export function HexagonIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 2.5 20.5 7.5v9L12 21.5 3.5 16.5v-9Z" />
      <path d="M12 8v8" />
      <path d="M8.5 10.5h7" />
    </svg>
  );
}

export function DatabaseIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <ellipse
        cx="12"
        cy="5.5"
        rx="7.5"
        ry="2.8"
      />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" />
      <path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </svg>
  );
}

export function LayersIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

export function QueueIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <rect
        x="3"
        y="4"
        width="13"
        height="6"
        rx="1.5"
      />
      <rect
        x="3"
        y="14"
        width="13"
        height="6"
        rx="1.5"
      />
      <path d="M19 9v11" />
      <path d="m16.5 18.5 2.5 2.5 2.5-2.5" />
    </svg>
  );
}

export function BoxIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <path d="M21 8.5v7L12 20l-9-4.5v-7L12 4Z" />
      <path d="M3.5 8.5 12 13l8.5-4.5" />
      <path d="M12 13v7" />
    </svg>
  );
}

export function FileSearchIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8Z" />
      <path d="M14 3v5h4" />
      <circle
        cx="11"
        cy="14"
        r="2.5"
      />
      <path d="m13 16 2.5 2.5" />
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps): JSX.Element {
  return (
    <svg {...baseProps(props)}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
