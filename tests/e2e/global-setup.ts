import type { FullConfig } from "@playwright/test";
import { setupRun } from "./support";

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3100";
  await setupRun(baseURL);
}
