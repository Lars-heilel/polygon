import * as dotenv from 'dotenv';
import path, { join } from 'path';
import { defineConfig } from 'prisma/config';

const envFileName =
  process.env['NODE_ENV'] === 'test'
    ? '.env.test'
    : process.env['NODE_ENV'] === 'production'
    ? '.env.production'
    : '.env';
var envFile = path.resolve(join(__dirname, `../../../${envFileName}`));
dotenv.config({ path: envFile });

export default defineConfig({
  schema: 'src/database/prisma/schema.prisma',
  migrations: {
    path: 'src/database/prisma/migrations',
  },
  datasource: {
    url: process.env['USER_DATABASE_URL'],
  },
});
