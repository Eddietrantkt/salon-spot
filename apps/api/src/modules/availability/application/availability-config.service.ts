import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_HOLD_TTL_SECONDS = 600;

/** Availability-owned runtime limits shared by HTTP commands and the worker. */
@Injectable()
export class AvailabilityConfigService implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    void this.holdTtlSeconds;
  }

  get holdTtlSeconds(): number {
    const raw = this.config.get<string>('SLOT_HOLD_TTL_SECONDS');
    if (!raw) return DEFAULT_HOLD_TTL_SECONDS;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 60 || value > 3_600) {
      throw new Error('SLOT_HOLD_TTL_SECONDS must be an integer from 60 to 3600.');
    }
    return value;
  }
}
