import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { HttpError } from './http-error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    // Check by duck-typing too — instanceof can fail across module boundaries in serverless bundles
    const isHttpError =
      exception instanceof HttpError ||
      (exception instanceof Error &&
        (exception as unknown as { name?: string }).name === 'HttpError' &&
        typeof (exception as unknown as { status?: number }).status === 'number');

    if (isHttpError) {
      const e = exception as HttpError;
      return res.status(e.status).json({ error: e.message });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string }).message ?? exception.message);
      return res.status(status).json({ error: message });
    }

    const message = exception instanceof Error ? exception.message : 'Erro interno';
    this.logger.error(message, exception instanceof Error ? exception.stack : undefined);
    return res.status(500).json({ error: message });
  }
}
