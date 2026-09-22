import type { JSX } from 'react';

import { BrandIcon, Heading } from '@org/shared';

import dockerUrl from '../icons/docker.svg';
import meilisearchUrl from '../icons/meilisearch.svg';
import minioUrl from '../icons/minio.svg';
import nestjsUrl from '../icons/nestjs.svg';
import nxUrl from '../icons/nx.svg';
import postgresqlUrl from '../icons/postgresql.svg';
import prismaUrl from '../icons/prisma.svg';
import rabbitmqUrl from '../icons/rabbitmq.svg';
import reactRouterUrl from '../icons/react-router.svg';
import reactUrl from '../icons/react.svg';
import redisUrl from '../icons/redis.svg';
import socketIoUrl from '../icons/socket-io.svg';
import tailwindcssUrl from '../icons/tailwindcss.svg';
import tanstackQueryUrl from '../icons/tanstack-query.svg';
import typescriptUrl from '../icons/typescript.svg';
import viteUrl from '../icons/vite.svg';
import zodUrl from '../icons/zod.svg';
import zustandUrl from '../icons/zustand.svg';

interface Technology {
  src: string;
  title: string;
  text: string;
}

const FRONTEND_TECHNOLOGIES: Technology[] = [
  { src: reactUrl, title: 'React', text: 'UI library' },
  { src: viteUrl, title: 'Vite', text: 'Build tool' },
  { src: zustandUrl, title: 'Zustand', text: 'Client state' },
  { src: tailwindcssUrl, title: 'Tailwind CSS', text: 'Styling' },
  { src: reactRouterUrl, title: 'React Router', text: 'Routing' },
  { src: tanstackQueryUrl, title: 'TanStack Query', text: 'Server state' },
];

const BACKEND_TECHNOLOGIES: Technology[] = [
  { src: nestjsUrl, title: 'NestJS', text: 'API framework' },
  { src: postgresqlUrl, title: 'PostgreSQL', text: 'Database' },
  { src: prismaUrl, title: 'Prisma ORM', text: 'ORM' },
  { src: redisUrl, title: 'Redis', text: 'Cache' },
  { src: rabbitmqUrl, title: 'RabbitMQ', text: 'Message broker' },
  { src: minioUrl, title: 'MinIO', text: 'S3-compatible files' },
  { src: meilisearchUrl, title: 'Meilisearch', text: 'Search engine' },
];

const SHARED_TECHNOLOGIES: Technology[] = [
  { src: typescriptUrl, title: 'TypeScript', text: 'Language' },
  { src: zodUrl, title: 'Zod', text: 'Contracts' },
  { src: dockerUrl, title: 'Docker', text: 'Containers' },
  { src: nxUrl, title: 'Monorepo Nx', text: 'Monorepo' },
  { src: socketIoUrl, title: 'Socket.IO', text: 'Realtime transport' },
];

export function LandingStack(): JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8  px-4 py-6 md:py-8">
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
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          <StackGroup
            id="landing-stack-frontend-title"
            title="Frontend"
            items={FRONTEND_TECHNOLOGIES}
          />
          <StackGroup
            id="landing-stack-backend-title"
            title="Backend"
            items={BACKEND_TECHNOLOGIES}
          />
          <StackGroup
            id="landing-stack-shared-title"
            title="Shared"
            items={SHARED_TECHNOLOGIES}
          />
        </div>
      </section>
    </div>
  );
}

function StackGroup({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: Technology[];
}): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <Heading
        level={3}
        id={id}
      >
        {title}
      </Heading>
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.title}
            title={item.text}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text transition-colors hover:border-primary/40"
          >
            <BrandIcon
              src={item.src}
              size="sm"
            />
            {item.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
