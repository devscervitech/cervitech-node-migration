import Joi from 'joi';
import { GOAL_FREQUENCY } from '../../enums/goalFrequency';
import { MAX_TARGETED_AVERAGE_NECK_ANGLE } from '../../services/goalCycle';

export const goalTurnOnSchema = Joi.object({
  targetedAverageNeckAngle: Joi.number()
    .strict()
    .greater(0)
    .max(MAX_TARGETED_AVERAGE_NECK_ANGLE)
    .custom((value, helpers) =>
      Number.isFinite(value) ? value : helpers.error('number.base'),
      'finite number'
    )
    .required(),
  frequency: Joi.string()
    .valid(...Object.values(GOAL_FREQUENCY))
    .required(),
})
  .required();
