import type { JSX } from 'react';
import { useState } from 'react';

import { Heading, Text } from '@org/shared';

import messengerUrl from '../images/messenger.png';
import mobileMessengerUrl from '../images/mobile-messenger.png';

interface Slide {
  src: string;
  alt: string;
  caption: string;
  narrow?: boolean;
}

const SLIDES: Slide[] = [
  {
    src: messengerUrl,
    alt: 'Polygon messenger on desktop',
    caption: 'Desktop — chats, media and voice in one window',
  },
  {
    src: mobileMessengerUrl,
    alt: 'Polygon messenger on mobile',
    caption: 'Mobile — full chat with bottom navigation',
    narrow: true,
  },
];

export function LandingScreenshots(): JSX.Element {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] ?? SLIDES[0];

  const goTo = (next: number) => {
    setIndex((next + SLIDES.length) % SLIDES.length);
  };

  return (
    <section
      aria-labelledby="landing-screenshots-title"
      className="relative overflow-hidden border-t border-border/60"
    >
      <div className="relative mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 md:py-14">
        <div className="flex max-w-xl flex-col gap-2">
          <Text
            size="sm"
            color="primary"
            weight="semibold"
            className="uppercase tracking-widest"
          >
            Product tour
          </Text>
          <Heading
            level={2}
            id="landing-screenshots-title"
          >
            Screenshots
          </Heading>
          <Text
            size="md"
            color="muted"
          >
            The real app — desktop and mobile, same account.
          </Text>
        </div>

        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm">
            <img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              loading="lazy"
              className={
                slide.narrow
                  ? 'mx-auto h-auto w-full max-w-sm object-contain'
                  : 'h-auto w-full object-cover'
              }
            />
          </div>
          <Text
            size="sm"
            color="muted"
            className="text-center"
          >
            {slide.caption}
          </Text>

          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Previous screenshot"
              onClick={() => goTo(index - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-text transition-colors hover:border-primary/40 hover:text-primary"
            >
              <span aria-hidden="true">←</span>
            </button>
            <div className="flex items-center gap-2">
              {SLIDES.map((item, dotIndex) => (
                <button
                  key={item.src}
                  type="button"
                  aria-label={`Go to screenshot ${dotIndex + 1}`}
                  aria-current={dotIndex === index}
                  onClick={() => goTo(dotIndex)}
                  className={`h-2 rounded-full transition-colors ${
                    dotIndex === index
                      ? 'w-6 bg-primary'
                      : 'w-2 bg-border-strong hover:bg-text-muted'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next screenshot"
              onClick={() => goTo(index + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-elevated text-text transition-colors hover:border-primary/40 hover:text-primary"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
