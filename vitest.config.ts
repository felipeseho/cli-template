import {fileURLToPath} from 'node:url'

import {defineConfig} from 'vitest/config'

const sourceRoot = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      {find: /^@\/(.*)\.js$/u, replacement: `${sourceRoot}/$1`},
      {find: '@', replacement: sourceRoot},
    ],
  },
  test: {
    clearMocks: true,
    coverage: {
      exclude: [
        'src/components/ui/**',
        'src/lib/**',
        'src/providers/**',
        'src/tui/components/ui/**',
        'src/tui/hooks/**',
      ],
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    disableConsoleIntercept: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true,
    setupFiles: ['./test/setup.ts'],
    unstubEnvs: true,
  },
})
