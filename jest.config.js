module.exports = {
  testEnvironment: 'node',
  // Runs before each test file's modules are required — see the file for why.
  setupFiles: ['<rootDir>/tests/setup.js'],
  // Run test files one at a time. They share a single Redis DB (db 15) and flush it
  // between tests, so running files in parallel would let them clobber each other.
  maxWorkers: 1,
};
