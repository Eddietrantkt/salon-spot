import { Module } from '@nestjs/common';

/** Reserved for communication; it must not mutate booking or payment state. */
@Module({})
export class ChatModule {}
