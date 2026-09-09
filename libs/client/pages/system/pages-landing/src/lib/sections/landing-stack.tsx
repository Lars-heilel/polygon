import type { JSX } from 'react';
import { Heading, Text } from '@org/shared';

const CAPABILITIES: string[] = [
  'Direct and saved-message chats',
  'Real-time updates over Socket.IO',
  'Media sharing through the gateway',
  'User search',
  'Notifications',
];

const TECHNOLOGIES: string[] = [
  'React + Vite SPA',
  'NestJS API Gateway',
  'PostgreSQL per service',
  'Redis sessions',
  'RabbitMQ events',
  'MinIO media storage',
  'Meilisearch user search',
];

export function LandingStack(): JSX.Element {
  return (
    <section
      id="stack"
      aria-labelledby="landing-stack-title"
      className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 px-4 py-10 md:grid-cols-2"
    >
      <div className="flex flex-col gap-3">
        <Heading
          level={2}
          id="landing-stack-title"
        >
          What you get
        </Heading>
        <ul className="flex flex-col gap-2">
          {CAPABILITIES.map((item) => (
            <li key={item}>
              <Text as="span">{item}</Text>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <Heading level={2}>Built on</Heading>
        <ul className="flex flex-col gap-2">
          {TECHNOLOGIES.map((item) => (
            <li key={item}>
              <Text
                as="span"
                color="muted"
              >
                {item}
              </Text>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
