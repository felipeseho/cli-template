import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

const deepFeatureCoreImport = {
  regex: String.raw`^@/features/[^/]+/core(?:/|$)`,
  message: 'Import another feature through its root index instead of its core internals.',
}

const relativeFeatureCoreImport = {
  regex: String.raw`^(?:\.\./)+(?:features/)?[^/]+/core(?:/|$)`,
  message: 'Import a feature through its root index instead of its core internals.',
}

const coreExternalBoundaryImport = {
  regex: String.raw`^(?:@/(?:cli|commands|runtime|tui)(?:/|$)|@/features/[^/]+/(?:adapters|cli|tui)(?:/|$)|(?:\.\./)+(?:runtime|commands)(?:/|$)|(?:\.\./)+(?:features/)?(?:[^/]+/)?(?:adapters|cli|tui)(?:/|$))`,
  message: 'Feature core cannot depend on adapters or delivery/runtime boundaries.',
}

const coreFrameworkImport = {
  regex: String.raw`^(?:node:|@oclif/core(?:/|$)|execa(?:/|$)|ink(?:/|$)|react(?:/|$))`,
  message: 'Feature core must remain independent from platform, CLI, UI, and infrastructure APIs.',
}

const featureRootOuterExport = {
  regex: String.raw`^(?:(?:\./)?(?:adapters|cli|tui)(?:/|$)|@/features/[^/]+/(?:adapters|cli|tui)(?:/|$))`,
  message: 'A feature root index may expose only its core API.',
}

const workspaceFeatureImport = {
  regex: String.raw`^(?:@/features/(?:doctor|tasks)(?:/|$)|(?:\.\./)+(?:features/)?(?:doctor|tasks)(?:/|$))`,
  message: 'Workspace is foundational and cannot depend on doctor or tasks.',
}

const tasksDoctorBoundaryImport = {
  regex: String.raw`^(?:@/features/doctor(?:/|$)|(?:\.\./)+(?:features/)?doctor(?:/|$))`,
  message: 'Tasks and doctor are independent features and cannot import each other.',
}

const doctorTasksBoundaryImport = {
  regex: String.raw`^(?:@/features/tasks(?:/|$)|(?:\.\./)+(?:features/)?tasks(?:/|$))`,
  message: 'Doctor and tasks are independent features and cannot import each other.',
}

const workspaceOuterBoundaryImport = {
  regex: String.raw`^(?:@/features/workspace/(?:adapters|cli|tui)(?:/|$)|(?:\.\./)+(?:features/)?workspace/(?:adapters|cli|tui)(?:/|$))`,
  message: 'Other features may depend only on the workspace core API.',
}

const restrictImports = (...patterns) => ['error', {patterns}]

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'oclif.manifest.json',
      // termcn is vendored registry source. Keep it upgradeable byte-for-byte.
      'src/components/ui/**',
      'src/lib/**',
      'src/providers/**',
      'src/tui/components/ui/**',
      'src/tui/hooks/**',
    ],
  },
  {
    ...eslint.configs.recommended,
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ...eslint.configs.recommended.languageOptions,
      globals: {
        URL: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    extends: [eslint.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      'no-restricted-imports': restrictImports(deepFeatureCoreImport),
    },
  },
  {
    files: [
      'src/index.ts',
      'src/cli/**/*.{ts,tsx}',
      'src/commands/**/*.{ts,tsx}',
      'src/runtime/**/*.{ts,tsx}',
      'src/tui/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': restrictImports(deepFeatureCoreImport, relativeFeatureCoreImport),
    },
  },
  {
    files: ['src/features/*/index.ts'],
    rules: {
      'no-restricted-imports': restrictImports(deepFeatureCoreImport, featureRootOuterExport),
    },
  },
  {
    files: ['src/features/workspace/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        deepFeatureCoreImport,
        featureRootOuterExport,
        workspaceFeatureImport,
      ),
    },
  },
  {
    files: ['src/features/tasks/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        deepFeatureCoreImport,
        featureRootOuterExport,
        tasksDoctorBoundaryImport,
        workspaceOuterBoundaryImport,
      ),
    },
  },
  {
    files: ['src/features/doctor/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        deepFeatureCoreImport,
        featureRootOuterExport,
        doctorTasksBoundaryImport,
        workspaceOuterBoundaryImport,
      ),
    },
  },
  {
    files: ['src/features/*/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        deepFeatureCoreImport,
        coreExternalBoundaryImport,
        coreFrameworkImport,
      ),
    },
  },
  {
    files: ['src/features/workspace/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        deepFeatureCoreImport,
        workspaceFeatureImport,
        coreExternalBoundaryImport,
        coreFrameworkImport,
      ),
    },
  },
  {
    files: ['src/features/tasks/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        deepFeatureCoreImport,
        tasksDoctorBoundaryImport,
        workspaceOuterBoundaryImport,
        coreExternalBoundaryImport,
        coreFrameworkImport,
      ),
    },
  },
  {
    files: ['src/features/doctor/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        deepFeatureCoreImport,
        doctorTasksBoundaryImport,
        workspaceOuterBoundaryImport,
        coreExternalBoundaryImport,
        coreFrameworkImport,
      ),
    },
  },
)
