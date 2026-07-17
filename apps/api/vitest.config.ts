import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/types/**',
        'src/docs/swagger.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        // Meaningful floor — not 100%. Focus areas covered by integration/unit suites.
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50,
      },
    },
  },
});
