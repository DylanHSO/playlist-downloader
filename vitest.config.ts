import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node-omgeving voor server-unit- en API-tests (supertest).
    environment: 'node',
    include: ['tests/**/*.test.ts', 'server/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    globals: true,
  },
});
