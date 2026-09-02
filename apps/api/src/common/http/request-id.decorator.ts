import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithId {
  requestId?: string;
}

export const RequestId = createParamDecorator((_: unknown, context: ExecutionContext): string | undefined => {
  return context.switchToHttp().getRequest<RequestWithId>().requestId;
});
