import { cleanupRun, readRun } from "./support";

export default async function globalTeardown() {
  await cleanupRun(readRun());
}
