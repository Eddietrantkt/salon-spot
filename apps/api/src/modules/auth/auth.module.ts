import { Global, Module } from '@nestjs/common';
import { AuthConfigService } from './application/auth-config.service.js';
import { AuthService } from './application/auth.service.js';
import { AccessTokenService } from './application/access-token.service.js';
import { PasswordService } from './application/password.service.js';
import { AuthController } from './presentation/auth.controller.js';
import { AccessTokenGuard } from './presentation/access-token.guard.js';

/** Owns credentials, sessions and token lifecycle. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthConfigService, PasswordService, AccessTokenService, AuthService, AccessTokenGuard],
  exports: [AccessTokenGuard, AccessTokenService, AuthService]
})
export class AuthModule {}
