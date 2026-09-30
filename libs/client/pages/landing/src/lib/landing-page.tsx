import type { JSX } from 'react';
import { useEffect } from 'react';

import { LandingFooter } from './ui/sections/landing-footer';
import { LandingHeader } from './ui/sections/landing-header';
import { LandingHero } from './ui/sections/landing-hero';
import { LandingScreenshots } from './ui/sections/landing-screenshots';
import { LandingStack } from './ui/sections/landing-stack';

const ROBOTS_CONTENT = 'noindex, nofollow, noarchive';

function upsertRobotsMeta(): () => void {
  const previous = document.querySelector('meta[name="robots"]');
  const hadPrevious = previous !== null;
  const previousContent = previous?.getAttribute('content');
  let meta = previous as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'robots');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', ROBOTS_CONTENT);
  return () => {
    if (hadPrevious && previous) {
      if (previousContent === null || previousContent === undefined) {
        previous.removeAttribute('content');
      } else {
        previous.setAttribute('content', previousContent);
      }
    } else {
      meta?.remove();
    }
  };
}

export function LandingPage(): JSX.Element {
  useEffect(() => upsertRobotsMeta(), []);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text">
      <LandingHeader />
      <main
        id="main"
        className="flex w-full flex-1 flex-col"
      >
        <LandingHero />
        <LandingScreenshots />
        <LandingStack />
      </main>
      <LandingFooter />
    </div>
  );
}
