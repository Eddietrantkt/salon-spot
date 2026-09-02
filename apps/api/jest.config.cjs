module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.jest.json', diagnostics: { ignoreCodes: [151002] } }] },
  moduleNameMapper: {
    '^@salon-spot/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/common/health/health.service.ts',
    'src/common/http/request-id.interceptor.ts',
    'src/modules/discovery/application/**/*.ts',
    'src/modules/auth/application/**/*.ts',
    'src/modules/auth/presentation/access-token.guard.ts',
    'src/modules/admin/application/**/*.ts',
    'src/modules/admin/presentation/admin.guard.ts',
    'src/modules/salons/application/**/*.ts',
    'src/modules/salons/presentation/salon-owner.guard.ts'
  ],
  testEnvironment: 'node'
};
