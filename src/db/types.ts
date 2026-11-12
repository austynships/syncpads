import { customType } from "drizzle-orm/mysql-core";

/**
 * JSON column that works on MariaDB.
 * MariaDB stores JSON as LONGTEXT, so the driver hands back a string; parse it here.
 */
export const json = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType() {
      return "json";
    },
    toDriver(value) {
      return JSON.stringify(value);
    },
    fromDriver(value) {
      return (typeof value === "string" ? JSON.parse(value) : value) as T;
    },
  })(name);

/** Embedding size used across the app. Changing it needs a migration. */
export const EMBEDDING_DIMENSIONS = 1024; // voyage-4 output_dimension

/** MEDIUMBLOB (binary up to 16 MB), read and written as a Buffer. */
export const mediumblob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "mediumblob";
  },
});

/**
 * MariaDB 11.8 VECTOR(n) column.
 * Reads come back as raw float32 bytes and are decoded to number[].
 * Writes go through raw SQL with VEC_FromText() — see src/db/vector.ts.
 */
export const vector = customType<{
  data: number[];
  driverData: Buffer;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? EMBEDDING_DIMENSIONS})`;
  },
  fromDriver(value) {
    const result: number[] = [];
    for (let offset = 0; offset < value.length; offset += 4) {
      result.push(value.readFloatLE(offset));
    }
    return result;
  },
});
