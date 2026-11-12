import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// MariaDB 11.8 speaks the MySQL protocol, so drizzle-kit uses the "mysql" dialect.
export default defineConfig({
  dialect: "mysql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});

