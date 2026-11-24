import Joi from 'joi';

export const MAX_NECK_ANGLE_BATCH_SIZE = 100;
export const MAX_RANDOM_NECK_ANGLE_RECORDS = 30;

const neckAngleRecordSchema = Joi.object({
  _id: Joi.string().max(128).optional(),
  __v: Joi.number().integer().min(0).optional(),
  appUserId: Joi.string().max(128).optional().description('Ignored; ownership is taken from the authenticated token.'),
  angle: Joi.number().required(),
  craniumVertebralAngle: Joi.number()
    .optional()
    .description('Ignored; the server calculates this value from angle.'),
  dateTimeRecorded: Joi.date().iso().required(),
  counter: Joi.number()
    .integer()
    .min(0)
    .optional()
    .description('Ignored; the server assigns the next counter.'),
});

export const neckAngleBatchSchema = Joi.object({
  appUserId: Joi.string()
    .max(128)
    .optional()
    .description('Ignored; record ownership is taken from the authenticated token.'),
  angles: Joi.number().optional().description('Legacy field; ignored.'),
  neckAngleRecords: Joi.array()
    .items(neckAngleRecordSchema)
    .min(1)
    .max(MAX_NECK_ANGLE_BATCH_SIZE)
    .required()
    .messages({
      'array.min': 'At least one neck-angle record is required',
      'array.max': `A maximum of ${MAX_NECK_ANGLE_BATCH_SIZE} records is allowed per request`,
      'any.required': 'Neck-angle records are required',
    }),
}).prefs({ abortEarly: false, allowUnknown: false });

export const randomNeckAngleBatchSchema = Joi.object({
  appUserId: Joi.string().trim().min(1).max(128).required(),
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(),
  numberOfRecords: Joi.number()
    .integer()
    .min(1)
    .max(MAX_RANDOM_NECK_ANGLE_RECORDS)
    .required(),
}).prefs({ abortEarly: false, allowUnknown: false });
