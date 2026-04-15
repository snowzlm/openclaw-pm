module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '\\.d\\.ts$'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/cli.ts', // CLI 入口不测试
  ],
  coverageThreshold: {
    global: {
      branches: 44,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  coverageDirectory: 'coverage',
  verbose: true,
};
