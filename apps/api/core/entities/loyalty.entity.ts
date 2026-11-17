/**
 * Local contract shim. The definition now lives in `@neutra/commons`; this
 * module only re-exports it so existing `@/core/entities/*` imports keep
 * working while the API migrates. No definitions are duplicated here.
 */
export {
    LoyaltyCampaignStatus,
    LoyaltyCampaignAction,
    LoyaltyCampaignSource,
    LoyaltyCampaignMetric,
    LoyaltySourceType,
    LoyaltyLedgerEntryType,
    LoyaltyRewardClaimStatus,
    LoyaltyStatus,
    LoyaltyCampaignCustomerStatus,
} from "@neutra/commons";
export type {
    LoyaltyCampaignReward,
    LoyaltyCampaign,
    LoyaltyCampaignLedgerEntry,
    LoyaltyCampaignContributionInput,
    LoyaltyCampaignProgress,
    LoyaltyCampaignCustomerSummary,
    LoyaltyCampaignRewardClaim,
} from "@neutra/commons";
