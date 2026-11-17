import { z } from "zod";
import { wireDateSchema } from "../../_common/dto-primitives.js";
import { ICouponResponseSchema } from "../../catalog/dtos/coupon.response.js";
import {
  CouponTypeSchema,
  LoyaltyCampaignMetricSchema,
  LoyaltyCampaignSourceSchema,
  LoyaltyCampaignStatusSchema,
  LoyaltyRewardClaimStatusSchema,
  LoyaltyStatusSchema,
} from "../../enums/index.js";

/** Ported from `responses/loyalty/loyalty.response.ts`. */

export const ILoyaltyCampaignRewardResponseSchema = z.object({
  type: CouponTypeSchema,
  value: z.number(),
  description: z.string().nullable().optional(),
  minPurchaseAmount: z.number().nullable().optional(),
  maxDiscountAmount: z.number().nullable().optional(),
  applicableProducts: z.array(z.string()),
  applicableCategories: z.array(z.string()),
  applicableServices: z.array(z.string()),
});
export type ILoyaltyCampaignRewardResponse = z.infer<
  typeof ILoyaltyCampaignRewardResponseSchema
>;

export const ILoyaltyCampaignResponseSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  source: LoyaltyCampaignSourceSchema,
  metric: LoyaltyCampaignMetricSchema,
  targetValue: z.string(),
  status: LoyaltyCampaignStatusSchema,
  startsAt: wireDateSchema,
  endsAt: wireDateSchema,
  claimUntil: wireDateSchema,
  rewardCouponId: z.string().nullable().optional(),
  reward: ILoyaltyCampaignRewardResponseSchema.optional(),
  rewardValidDays: z.number().nullable().optional(),
  maxClaims: z.number().nullable().optional(),
  claimedCount: z.number(),
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type ILoyaltyCampaignResponse = z.infer<
  typeof ILoyaltyCampaignResponseSchema
>;

export const ILoyaltyCampaignClaimMetadataResponseSchema = z.object({
  id: z.string(),
  campaignId: z.string(),
  couponId: z.string(),
  status: LoyaltyRewardClaimStatusSchema,
  createdAt: wireDateSchema,
  updatedAt: wireDateSchema,
});
export type ILoyaltyCampaignClaimMetadataResponse = z.infer<
  typeof ILoyaltyCampaignClaimMetadataResponseSchema
>;

export const ILoyaltyCampaignClaimResponseSchema =
  ILoyaltyCampaignClaimMetadataResponseSchema.extend({
    coupon: ICouponResponseSchema,
  });
export type ILoyaltyCampaignClaimResponse = z.infer<
  typeof ILoyaltyCampaignClaimResponseSchema
>;

export const ILoyaltyCustomerCampaignSummaryResponseSchema = z.object({
  campaignId: z.string(),
  name: z.string(),
  source: LoyaltyCampaignSourceSchema,
  startsAt: wireDateSchema,
  endsAt: wireDateSchema,
  claimUntil: wireDateSchema,
  metric: LoyaltyCampaignMetricSchema,
  progressValue: z.string(),
  targetValue: z.string(),
  remainingValue: z.string(),
  lifecycleStatus: LoyaltyCampaignStatusSchema,
  customerStatus: LoyaltyStatusSchema,
  progress: z.string().optional(),
  target: z.string().optional(),
  remaining: z.string().optional(),
  status: LoyaltyStatusSchema.optional(),
  campaignStatus: LoyaltyCampaignStatusSchema.optional(),
  claim: ILoyaltyCampaignClaimMetadataResponseSchema.optional(),
  coupon: ICouponResponseSchema.optional(),
});
export type ILoyaltyCustomerCampaignSummaryResponse = z.infer<
  typeof ILoyaltyCustomerCampaignSummaryResponseSchema
>;

export const ILoyaltyTenantCampaignOverviewResponseSchema = z.object({
  tenantId: z.string(),
  name: z.string(),
  slug: z.string(),
  type: z.string(),
  active: z.boolean(),
  campaigns: z.array(ILoyaltyCampaignResponseSchema),
  stats: z.object({
    campaignCount: z.number(),
    activeCampaignCount: z.number(),
    endedCampaignCount: z.number(),
    archivedCampaignCount: z.number(),
    totalClaims: z.number(),
  }),
});
export type ILoyaltyTenantCampaignOverviewResponse = z.infer<
  typeof ILoyaltyTenantCampaignOverviewResponseSchema
>;

/** Backwards-compatible aliases exported by the source file. */
export const ICampaignResponseSchema = ILoyaltyCampaignResponseSchema;
export type ICampaignResponse = ILoyaltyCampaignResponse;
export const LoyaltyCampaignResponseSchema = ILoyaltyCampaignResponseSchema;
export type LoyaltyCampaignResponse = ILoyaltyCampaignResponse;

export const ICustomerLoyaltyCampaignSummaryResponseSchema =
  ILoyaltyCustomerCampaignSummaryResponseSchema;
export type ICustomerLoyaltyCampaignSummaryResponse =
  ILoyaltyCustomerCampaignSummaryResponse;
export const LoyaltyCustomerCampaignSummaryResponseSchema =
  ILoyaltyCustomerCampaignSummaryResponseSchema;
export type LoyaltyCustomerCampaignSummaryResponse =
  ILoyaltyCustomerCampaignSummaryResponse;

export const ICampaignClaimResponseSchema = ILoyaltyCampaignClaimResponseSchema;
export type ICampaignClaimResponse = ILoyaltyCampaignClaimResponse;
export const LoyaltyCampaignClaimResponseSchema =
  ILoyaltyCampaignClaimResponseSchema;
export type LoyaltyCampaignClaimResponse = ILoyaltyCampaignClaimResponse;

export const ITenantLoyaltyCampaignOverviewResponseSchema =
  ILoyaltyTenantCampaignOverviewResponseSchema;
export type ITenantLoyaltyCampaignOverviewResponse =
  ILoyaltyTenantCampaignOverviewResponse;
export const LoyaltyTenantCampaignOverviewResponseSchema =
  ILoyaltyTenantCampaignOverviewResponseSchema;
export type LoyaltyTenantCampaignOverviewResponse =
  ILoyaltyTenantCampaignOverviewResponse;
