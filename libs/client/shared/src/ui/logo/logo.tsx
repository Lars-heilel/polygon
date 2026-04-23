import logoUrl from '@org/common/assets/icons/favicon.svg';

import { Heading } from '../typography';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        className="h-12 mr-6 w-auto"
      />
      <Heading
        level={4}
        as="h1"
      >
        Polygon
      </Heading>
    </div>
  );
}
