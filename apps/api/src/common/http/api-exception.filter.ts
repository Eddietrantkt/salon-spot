import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { API_ERROR_CODES, type ApiError, type ApiErrorCode } from '@salon-spot/contracts';

interface RequestWithId {
  requestId?: string;
}

interface ResponseWriter {
  status(statusCode: number): ResponseWriter;
  json(body: ApiError): void;
}

/** Keeps every API failure on the shared transport contract. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<ResponseWriter>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.messageFor(exception);
    response.status(statusCode).json({
      code: this.codeFor(exception, statusCode),
      message,
      requestId: request.requestId ?? 'unknown'
    });
  }

  private messageFor(exception: unknown): string {
    if (!(exception instanceof HttpException)) return 'An unexpected error occurred.';
    const response = exception.getResponse();
    if (typeof response === 'string') return response;
    if (typeof response === 'object' && response && 'message' in response) {
      const message = response.message;
      return Array.isArray(message) ? String(message[0] ?? 'Request failed.') : String(message);
    }
    return 'Request failed.';
  }

  private codeFor(exception: unknown, statusCode: number): ApiErrorCode {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response && 'code' in response && isApiErrorCode(response.code)) return response.code;
    }
    if (exception instanceof UnauthorizedException) return 'AUTHENTICATION_FAILED';
    if (exception instanceof ForbiddenException) return 'FORBIDDEN';
    if (exception instanceof NotFoundException) return 'NOT_FOUND';
    if (exception instanceof ConflictException) return 'CONFLICT';
    if (statusCode === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
    return 'INTERNAL_ERROR';
  }
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && API_ERROR_CODES.includes(value as ApiErrorCode);
}
