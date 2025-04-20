module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: './__tests__/coverage',
  collectCoverageFrom: [
    '*.ts',
    '!index.ts',
    '!__tests__/**',
    '!node_modules/**',
    '!dist/**'
  ],
  coverageThreshold: {
    global: {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  setupFilesAfterEnv: ['./__tests__/jest.setup.js']
}; 