import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'src/database/prisma/schema.prisma',
  migrations: {
    path: 'src/database/prisma/migrations',
  },
  datasource: {
    url: process.env['USER_DATABASE_URL'],
  },
});
