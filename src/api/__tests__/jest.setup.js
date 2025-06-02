// Global mock for acme-client to prevent issues in test environment
jest.mock('acme-client', () => ({
  crypto: {
    createPrivateKey: jest.fn().mockResolvedValue(Buffer.from('mock-key')),
    createCsr: jest.fn().mockResolvedValue([Buffer.from('mock-key'), Buffer.from('mock-csr')])
  },
  Client: jest.fn().mockImplementation(() => ({
    createAccount: jest.fn().mockResolvedValue({}),
    createOrder: jest.fn().mockResolvedValue({}),
    getAuthorizations: jest.fn().mockResolvedValue([]),
    getChallengeKeyAuthorization: jest.fn().mockResolvedValue('mock-key-auth'),
    verifyChallenge: jest.fn().mockResolvedValue({}),
    completeChallenge: jest.fn().mockResolvedValue({}),
    waitForValidStatus: jest.fn().mockResolvedValue({}),
    finalizeOrder: jest.fn().mockResolvedValue({}),
    getCertificate: jest.fn().mockResolvedValue('mock-certificate')
  }))
}));

// Silence console output during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;

// Replace console methods with no-op functions during tests
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
  console.debug = jest.fn();
});

// Restore original console methods after tests
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  console.debug = originalConsoleDebug;
}); 