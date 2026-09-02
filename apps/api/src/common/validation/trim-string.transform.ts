import { Transform } from 'class-transformer';

/** Never coerce missing fields into the literal string "undefined". */
export const TrimString = (): PropertyDecorator => Transform(({ value }) => typeof value === 'string' ? value.trim() : value);
