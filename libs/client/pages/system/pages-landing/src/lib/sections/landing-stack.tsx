import type { JSX } from 'react';

import { Heading, Text } from '@org/shared';
import type { LucideIcon } from 'lucide-react';
import {
  Atom,
  Box,
  Database,
  FileSearch,
  Hexagon,
  Layers,
  Rabbit,
} from 'lucide-react';

interface Technology {
  icon: LucideIcon;
  title: string;
  text: string;
}

const TECHNOLOGIES: Technology[] = [
  { icon: Atom, title: 'React', text: 'Frontend' },
  { icon: Hexagon, title: 'NestJS', text: 'Backend' },
  { icon: Database, title: 'PostgreSQL ', text: 'Database' },
  { icon: Layers, title: 'Redis', text: 'Cache' },
  { icon: Rabbit, title: 'RabbitMQ ', text: 'Message broker' },
  { icon: Box, title: 'MinIO media storage', text: 'S3-compatible files' },
  { icon: FileSearch, title: 'Meilisearch', text: 'Search engine' },
];

function IconBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }): JSX.Element {
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon
        aria-hidden="true"
        aria-label={label}
        className="h-5 w-5"
      />
    </span>
  );
}

export function LandingStack(): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10 md:py-16">
  
      <section
        id="stack"
        aria-labelledby="landing-stack-tech-title"
        className="flex flex-col gap-6"
      >
        <div className="flex max-w-xl flex-col gap-2">
          <Heading
            level={2}
            id="landing-stack-tech-title"
          >
          Tech Stack
          </Heading>
        </div>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TECHNOLOGIES.map((item) => (
            <li
              key={item.title}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface-elevated p-5 transition-colors hover:border-primary/40"
            >
              <IconBadge
                icon={item.icon}
                label=""
              />
              <span className="flex flex-col gap-1">
                <Text
                  as="span"
                  weight="medium"
                >
                  {item.title}
                </Text>
                <Text
                  as="span"
                  size="sm"
                  color="muted"
                >
                  {item.text}
                </Text>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
