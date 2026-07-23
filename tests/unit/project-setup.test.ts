import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

describe("project quality gate", () => {
  it("keeps every Phase 1 verification command available", () => {
    expect(packageJson.scripts).toMatchObject({
      build: "next build",
      lint: "eslint .",
      test: "vitest run",
      typecheck: "next typegen && tsc --noEmit",
    });
  });
});
