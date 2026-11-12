import { hash, verify } from "@node-rs/argon2";

// Argon2id with OWASP-recommended parameters (19 MiB memory, 2 iterations).
// algorithm 2 = Argon2id (the library's const enum can't be imported with isolatedModules).
const ARGON2ID = 2;
const options = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string) {
  return hash(password, options);
}

export function verifyPassword({ hash: stored, password }: { hash: string; password: string }) {
  return verify(stored, password);
}

