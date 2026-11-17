import { describe, expect, it } from "bun:test";
import {
	AppointmentStatus,
	AppointmentStatusSchema,
	CategoryType,
	CategoryTypeSchema,
	CouponType,
	CouponTypeSchema,
	LoyaltyCampaignAction,
	LoyaltyCampaignActionSchema,
	LoyaltyCampaignCustomerStatus,
	LoyaltyCampaignCustomerStatusSchema,
	LoyaltyCampaignMetric,
	LoyaltyCampaignMetricSchema,
	LoyaltyCampaignSource,
	LoyaltyCampaignSourceSchema,
	LoyaltyCampaignStatus,
	LoyaltyCampaignStatusSchema,
	LoyaltyLedgerEntryType,
	LoyaltyLedgerEntryTypeSchema,
	LoyaltyRewardClaimStatus,
	LoyaltyRewardClaimStatusSchema,
	LoyaltySourceType,
	LoyaltySourceTypeSchema,
	LoyaltyStatus,
	LoyaltyStatusSchema,
	OrderStatus,
	OrderStatusSchema,
	TenantType,
	TenantTypeSchema,
	WhatsAppMessageDirection,
	WhatsAppMessageDirectionSchema,
	WhatsAppMessageStatus,
	WhatsAppMessageStatusSchema,
	WhatsAppMessageType,
	WhatsAppMessageTypeSchema,
} from "../index";

describe("commons enums are the Zod SSOT", () => {
	it("AppointmentStatus has 7 options and PENDING is accessible as a value", () => {
		expect(AppointmentStatusSchema.options).toHaveLength(7);
		expect(AppointmentStatusSchema.options).toEqual([
			"PENDING",
			"CONFIRMED",
			"IN_PROGRESS",
			"NEEDS_REVIEW",
			"COMPLETED",
			"CANCELLED",
			"NO_SHOW",
		]);
		expect(AppointmentStatus.PENDING).toBe("PENDING");
		expect(AppointmentStatusSchema.parse(AppointmentStatus.PENDING)).toBe(
			"PENDING",
		);
	});

	it("CategoryType is PRODUCT / SERVICE", () => {
		expect(CategoryTypeSchema.options).toEqual(["PRODUCT", "SERVICE"]);
		expect(CategoryType).toEqual({ PRODUCT: "PRODUCT", SERVICE: "SERVICE" });
	});

	it("CouponType is PERCENT / FIXED", () => {
		expect(CouponTypeSchema.options).toEqual(["PERCENT", "FIXED"]);
		expect(CouponType).toEqual({ PERCENT: "PERCENT", FIXED: "FIXED" });
	});

	it("TenantType is STORE / BOOKING / HYBRID", () => {
		expect(TenantTypeSchema.options).toEqual(["STORE", "BOOKING", "HYBRID"]);
		expect(TenantType).toEqual({
			STORE: "STORE",
			BOOKING: "BOOKING",
			HYBRID: "HYBRID",
		});
	});

	it("OrderStatus accepts the four Spanish states and rejects anything else", () => {
		for (const value of ["PENDIENTE", "PAGADO", "ENVIADO", "ENTREGADO"]) {
			expect(OrderStatusSchema.safeParse(value).success).toBe(true);
		}
		expect(OrderStatusSchema.safeParse("CANCELADO").success).toBe(false);
		expect(OrderStatus).toEqual({
			PENDIENTE: "PENDIENTE",
			PAGADO: "PAGADO",
			ENVIADO: "ENVIADO",
			ENTREGADO: "ENTREGADO",
		});
	});

	it("all 8 Loyalty* enums exist with their source values", () => {
		expect(LoyaltyCampaignStatusSchema.options).toEqual([
			"DRAFT",
			"ACTIVE",
			"ENDED",
			"ARCHIVED",
		]);
		expect(LoyaltyCampaignActionSchema.options).toEqual([
			"activate",
			"end",
			"archive",
			"delete",
		]);
		expect(LoyaltyCampaignSourceSchema.options).toEqual([
			"BOOKING",
			"STORE",
			"ALL",
		]);
		expect(LoyaltyCampaignMetricSchema.options).toEqual(["COUNT", "SPEND"]);
		expect(LoyaltySourceTypeSchema.options).toEqual(["APPOINTMENT", "ORDER"]);
		expect(LoyaltyLedgerEntryTypeSchema.options).toEqual([
			"ACCRUAL",
			"REVERSAL",
		]);
		expect(LoyaltyRewardClaimStatusSchema.options).toEqual(["CLAIMED"]);
		expect(LoyaltyStatusSchema.options).toEqual([
			"NOT_STARTED",
			"IN_PROGRESS",
			"READY",
			"CLAIMED",
			"EXPIRED",
		]);

		// const objects are the schema's own `.enum` maps
		expect(LoyaltyCampaignStatus).toEqual(LoyaltyCampaignStatusSchema.enum);
		expect(LoyaltyCampaignAction).toEqual(LoyaltyCampaignActionSchema.enum);
		expect(LoyaltyCampaignSource).toEqual(LoyaltyCampaignSourceSchema.enum);
		expect(LoyaltyCampaignMetric).toEqual(LoyaltyCampaignMetricSchema.enum);
		expect(LoyaltySourceType).toEqual(LoyaltySourceTypeSchema.enum);
		expect(LoyaltyLedgerEntryType).toEqual(
			LoyaltyLedgerEntryTypeSchema.enum,
		);
		expect(LoyaltyRewardClaimStatus).toEqual(
			LoyaltyRewardClaimStatusSchema.enum,
		);
		expect(LoyaltyStatus).toEqual(LoyaltyStatusSchema.enum);

		// backwards-compatible alias kept by the API
		expect(LoyaltyCampaignCustomerStatusSchema.options).toEqual(
			LoyaltyStatusSchema.options,
		);
		expect(LoyaltyCampaignCustomerStatus).toEqual(LoyaltyStatus);
	});

	it("all 3 WhatsApp* unions exist with their source values", () => {
		expect(WhatsAppMessageTypeSchema.options).toEqual([
			"text",
			"image",
			"document",
			"audio",
			"video",
			"template",
			"interactive",
			"location",
			"sticker",
			"contacts",
		]);
		expect(WhatsAppMessageStatusSchema.options).toEqual([
			"sent",
			"delivered",
			"read",
			"failed",
			"pending",
		]);
		expect(WhatsAppMessageDirectionSchema.options).toEqual([
			"inbound",
			"outbound",
		]);
		expect(WhatsAppMessageType).toEqual(WhatsAppMessageTypeSchema.enum);
		expect(WhatsAppMessageStatus).toEqual(WhatsAppMessageStatusSchema.enum);
		expect(WhatsAppMessageDirection).toEqual(
			WhatsAppMessageDirectionSchema.enum,
		);
	});
});
