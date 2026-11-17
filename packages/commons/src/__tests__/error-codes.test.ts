import { describe, expect, it } from "bun:test";
import {
	AuthErrorCodes,
	BusinessErrorCodes,
	DatabaseErrorCodes,
	ErrorCodes,
	ExternalServiceErrorCodes,
	LoyaltyErrorCodes,
	RateLimitErrorCodes,
	ResourceErrorCodes,
	SystemErrorCodes,
	TenantErrorCodes,
	ValidationErrorCodes,
	WhatsAppErrorCodes,
} from "../_common";

const families = {
	AUTH_: AuthErrorCodes,
	VALIDATION_: ValidationErrorCodes,
	RESOURCE_: ResourceErrorCodes,
	TENANT_: TenantErrorCodes,
	BUSINESS_: BusinessErrorCodes,
	LOYALTY_: LoyaltyErrorCodes,
	DB_: DatabaseErrorCodes,
	EXTERNAL_: ExternalServiceErrorCodes,
	SYSTEM_: SystemErrorCodes,
	RATE_LIMIT_: RateLimitErrorCodes,
	WHATSAPP_: WhatsAppErrorCodes,
} as const;

describe("shared error catalog", () => {
	it("exports all 11 error families, each with its own prefix", () => {
		const prefixes = Object.keys(families);
		expect(prefixes).toHaveLength(11);

		for (const prefix of prefixes) {
			const family = families[prefix as keyof typeof families];
			const values = Object.values(family);
			expect(values.length).toBeGreaterThan(0);
			for (const value of values) {
				// Documented legacy wire value kept without the LOYALTY_ prefix.
				if (value === "INVALID_LOYALTY_REWARD_TEMPLATE") continue;
				expect(String(value).startsWith(prefix)).toBe(true);
			}
		}
	});

	it("ErrorCodes aggregates at least 90 codes", () => {
		expect(Object.values(ErrorCodes).length).toBeGreaterThanOrEqual(90);
	});
});
