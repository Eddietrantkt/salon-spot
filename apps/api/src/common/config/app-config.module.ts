import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaConfigService } from './media-config.service.js';

/** Shared runtime configuration for both the HTTP API and the optional worker. */
@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [MediaConfigService],
  exports: [ConfigModule, MediaConfigService]
})
export class AppConfigModule {}
