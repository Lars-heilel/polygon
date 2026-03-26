import * as dotenv from "dotenv";
import path, { join } from "path";
import { defineConfig } from "prisma/config";


var envFile = path.resolve(join(__dirname, "../../../.env"));
dotenv.config({ path: envFile });

export default defineConfig({
  schema: "src/database/prisma/schema.prisma",
  migrations: {
    path: "src/database/prisma/migrations",
  },
  datasource: {
    url: process.env["AUTH_DATABASE_URL"],
  },
});
