import Joi from 'joi';

export type ValidationResult<T> = { value: T; error: null } | { value: null; error: string };

/**
 * Validates a back-office request body.
 *
 * Unknown keys are rejected rather than passed through, values are trimmed or
 * converted per the schema, and the message names fields only (the schemas use
 * custom messages so submitted values are not echoed).
 */
export function validateBackofficeInput<T>(schema: Joi.ObjectSchema, input: unknown): ValidationResult<T> {
  const { error, value } = schema.validate(input ?? {}, {
    abortEarly: false,
    allowUnknown: false,
    convert: true,
  });

  if (error) {
    const message = error.details.map((detail) => detail.message.replace(/"/g, '')).join('; ');
    return { value: null, error: message };
  }

  return { value: value as T, error: null };
}
