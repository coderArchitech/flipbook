import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/frontend/**/*.test.{js,jsx}",
      "tests/backend/**/*.test.mjs",
    ],
    environment: "node",
    maxWorkers: 1,
    fileParallelism: false,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
