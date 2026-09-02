import { ConflictException, type ArgumentsHost } from '@nestjs/common';
import { ApiExceptionFilter } from './api-exception.filter.js';

describe('ApiExceptionFilter', () => {
  it('preserves a validated domain error code from an HttpException response', () => {
    const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ requestId: 'request_1' }),
        getResponse: () => response
      })
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(
      new ConflictException({ code: 'BOOKED_SLOT_IMMUTABLE', message: 'Booked slot is immutable.' }),
      host
    );

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      code: 'BOOKED_SLOT_IMMUTABLE',
      message: 'Booked slot is immutable.',
      requestId: 'request_1'
    });
  });
});
