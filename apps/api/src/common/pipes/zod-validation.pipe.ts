import { PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { HttpError } from '../exceptions/http-error';

export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const msg = result.error.issues?.[0]?.message ?? 'Dados inválidos';
      throw new HttpError(400, msg);
    }
    return result.data;
  }
}
