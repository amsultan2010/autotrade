/** Parse unknown input with a Zod schema, throwing a clean 400 on failure. */
import { z, type ZodType } from 'zod';
import { BadRequestError } from './errors';

export function parse<S extends ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestError('Validation failed', result.error.flatten());
  }
  return result.data;
}
