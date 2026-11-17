import { z } from "zod";

export const LoyaltyCampaignStatusSchema = z.enum({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  ARCHIVED: "ARCHIVED",
});
export const LoyaltyCampaignStatus = LoyaltyCampaignStatusSchema.enum;
export type LoyaltyCampaignStatus = z.infer<typeof LoyaltyCampaignStatusSchema>;

/** Object form keeps the original UPPERCASE member names with lowercase values. */
export const LoyaltyCampaignActionSchema = z.enum({
  ACTIVATE: "activate",
  END: "end",
  ARCHIVE: "archive",
  DELETE: "delete",
});
export const LoyaltyCampaignAction = LoyaltyCampaignActionSchema.enum;
export type LoyaltyCampaignAction = z.infer<typeof LoyaltyCampaignActionSchema>;

export const LoyaltyCampaignSourceSchema = z.enum({
  BOOKING: "BOOKING",
  STORE: "STORE",
  ALL: "ALL",
});
export const LoyaltyCampaignSource = LoyaltyCampaignSourceSchema.enum;
export type LoyaltyCampaignSource = z.infer<typeof LoyaltyCampaignSourceSchema>;

export const LoyaltyCampaignMetricSchema = z.enum({
  COUNT: "COUNT",
  SPEND: "SPEND",
});
export const LoyaltyCampaignMetric = LoyaltyCampaignMetricSchema.enum;
export type LoyaltyCampaignMetric = z.infer<typeof LoyaltyCampaignMetricSchema>;

export const LoyaltySourceTypeSchema = z.enum({
  APPOINTMENT: "APPOINTMENT",
  ORDER: "ORDER",
});
export const LoyaltySourceType = LoyaltySourceTypeSchema.enum;
export type LoyaltySourceType = z.infer<typeof LoyaltySourceTypeSchema>;

export const LoyaltyLedgerEntryTypeSchema = z.enum({
  ACCRUAL: "ACCRUAL",
  REVERSAL: "REVERSAL",
});
export const LoyaltyLedgerEntryType = LoyaltyLedgerEntryTypeSchema.enum;
export type LoyaltyLedgerEntryType = z.infer<
  typeof LoyaltyLedgerEntryTypeSchema
>;

export const LoyaltyRewardClaimStatusSchema = z.enum({
  CLAIMED: "CLAIMED",
});
export const LoyaltyRewardClaimStatus = LoyaltyRewardClaimStatusSchema.enum;
export type LoyaltyRewardClaimStatus = z.infer<
  typeof LoyaltyRewardClaimStatusSchema
>;

export const LoyaltyStatusSchema = z.enum({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  READY: "READY",
  CLAIMED: "CLAIMED",
  EXPIRED: "EXPIRED",
});
export const LoyaltyStatus = LoyaltyStatusSchema.enum;
export type LoyaltyStatus = z.infer<typeof LoyaltyStatusSchema>;

/** Backwards-compatible alias kept by the API (`LoyaltyCampaignCustomerStatus`). */
export const LoyaltyCampaignCustomerStatusSchema = LoyaltyStatusSchema;
export const LoyaltyCampaignCustomerStatus = LoyaltyStatus;
export type LoyaltyCampaignCustomerStatus = z.infer<
  typeof LoyaltyStatusSchema
>;
