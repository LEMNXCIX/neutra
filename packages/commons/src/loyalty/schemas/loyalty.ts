import { z } from "zod";
import {
  dateOrStringSchema,
  integerSchema,
  numericSchema,
} from "../../_common/dto-primitives.js";
import {
  CouponTypeSchema,
  LoyaltyCampaignActionSchema,
  LoyaltyCampaignMetricSchema,
  LoyaltyCampaignSourceSchema,
} from "../../enums/index.js";

/** Ported from `requests/loyalty.request.ts`. */

/** Mirrors `MAX_LOYALTY_PRISMA_INT` from the API loyalty policy. */
export const MAX_LOYALTY_PRISMA_INT = 2_147_483_647;

const stringList = z.array(z.string());
const boundedInteger = integerSchema.min(1).max(MAX_LOYALTY_PRISMA_INT);

export const LoyaltyRewardDefinitionDtoSchema = z.object({
  type: CouponTypeSchema,
  value: numericSchema.min(0),
  description: z.string().nullable().optional(),
  minPurchaseAmount: numericSchema.min(0).nullable().optional(),
  maxDiscountAmount: numericSchema.min(0).nullable().optional(),
  applicableProducts: stringList.optional(),
  applicableCategories: stringList.optional(),
  applicableServices: stringList.optional(),
});
export type LoyaltyRewardDefinitionDto = z.infer<
  typeof LoyaltyRewardDefinitionDtoSchema
>;

/**
 * The `@Transform(({ value }) => plainToInstance(LoyaltyRewardDefinitionDto,
 * value), { toClassOnly: true })` + `@ValidateNested()` pair is expressed by
 * nesting the reward's Zod schema: Zod parses the plain input into the same
 * typed shape the class-transformer produced.
 */
export const CreateLoyaltyCampaignDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  source: LoyaltyCampaignSourceSchema,
  metric: LoyaltyCampaignMetricSchema,
  targetValue: z.string().min(1),
  startsAt: dateOrStringSchema,
  endsAt: dateOrStringSchema,
  claimUntil: dateOrStringSchema,
  reward: LoyaltyRewardDefinitionDtoSchema,
  rewardValidDays: boundedInteger,
  maxClaims: boundedInteger.nullable().optional(),
});
export type CreateLoyaltyCampaignDto = z.infer<
  typeof CreateLoyaltyCampaignDtoSchema
>;

export const UpdateLoyaltyCampaignDtoSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  source: LoyaltyCampaignSourceSchema.optional(),
  metric: LoyaltyCampaignMetricSchema.optional(),
  targetValue: z.string().min(1).optional(),
  startsAt: dateOrStringSchema.optional(),
  endsAt: dateOrStringSchema.optional(),
  claimUntil: dateOrStringSchema.optional(),
  reward: LoyaltyRewardDefinitionDtoSchema.optional(),
  rewardValidDays: boundedInteger.optional(),
  maxClaims: boundedInteger.nullable().optional(),
});
export type UpdateLoyaltyCampaignDto = z.infer<
  typeof UpdateLoyaltyCampaignDtoSchema
>;

/** The API aliased the action enum as `LoyaltyCampaignLifecycleAction`. */
export const LoyaltyCampaignLifecycleActionSchema =
  LoyaltyCampaignActionSchema;
export type LoyaltyCampaignLifecycleAction = z.infer<
  typeof LoyaltyCampaignLifecycleActionSchema
>;

export const LoyaltyCampaignLifecycleDtoSchema = z.object({
  action: LoyaltyCampaignLifecycleActionSchema,
});
export type LoyaltyCampaignLifecycleDto = z.infer<
  typeof LoyaltyCampaignLifecycleDtoSchema
>;

/** Aliases retained by the source file. */
export type CreateLoyaltyCampaignRequest = CreateLoyaltyCampaignDto;
export type UpdateLoyaltyCampaignRequest = UpdateLoyaltyCampaignDto;
export type LoyaltyCampaignRewardDefinition = LoyaltyRewardDefinitionDto;
export type LoyaltyCampaignRewardDTO = LoyaltyRewardDefinitionDto;
export type CreateCampaignDTO = CreateLoyaltyCampaignDto;
export type UpdateCampaignDTO = UpdateLoyaltyCampaignDto;
