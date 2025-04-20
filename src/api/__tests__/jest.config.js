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
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  setupFilesAfterEnv: ['./__tests__/jest.setup.js']
}; 