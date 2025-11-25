module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    'models/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
  ],

  coverageThresholds: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
  ],

  // Test timeout (5 seconds default, 10s for integration tests)
  testTimeout: 10000,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Verbose output
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Clear mocks between tests
  clearMocks: true,

  // Detect open handles (useful for debugging hanging tests)
  detectOpenHandles: false,

  // Max workers (run tests sequentially for integration tests)
  maxWorkers: 1,

  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Transform files (if using TypeScript/Babel in future)
  transform: {},

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
  ],

  // Global setup/teardown
  // globalSetup: '<rootDir>/tests/globalSetup.js',
  // globalTeardown: '<rootDir>/tests/globalTeardown.js',
};
