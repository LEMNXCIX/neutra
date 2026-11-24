import { describe, expect, it } from "bun:test";
import {
	AcquireHoldRequestSchema,
	HoldEventSchema,
	holdKey,
	parseHoldKey,
} from "../availability";
import type { AvailableStock, HoldEvent } from "../availability";

describe("shared availability contracts", () => {
	it("(a) builds the canonical hold key", () => {
		expect(holdKey("appointment", "t1", "s1")).toBe(
			"hold:appointment:t1:s1",
		);
	});

	it("(a2) parses canonical hold keys back into tenant and resource", () => {
		expect(parseHoldKey(holdKey("product", "t1", "p1"))).toEqual({
			resourceType: "product",
			tenantId: "t1",
			resourceId: "p1",
		});
		expect(parseHoldKey(holdKey("appointment", "t1", "s1"))).toEqual({
			resourceType: "appointment",
			tenantId: "t1",
			resourceId: "s1",
		});
	});

	it("(a3) rejects non-hold and malformed keys", () => {
		expect(parseHoldKey("basura")).toBeNull();
		expect(parseHoldKey("other:product:t1:p1")).toBeNull();
		expect(parseHoldKey("hold:vehicle:t1:p1")).toBeNull();
		expect(parseHoldKey("hold:product:t1")).toBeNull();
		expect(parseHoldKey("hold:product:t1:p1:extra")).toBeNull();
	});

	it("(b) validates acquire-hold requests", () => {
		expect(
			AcquireHoldRequestSchema.parse({
				resourceType: "product",
				tenantId: "t1",
				resourceId: "p1",
			}),
		).toEqual({ resourceType: "product", tenantId: "t1", resourceId: "p1" });

		const base = { resourceType: "product", tenantId: "t1", resourceId: "p1" };
		expect(
			AcquireHoldRequestSchema.safeParse({ ...base, ttlSeconds: 0 }).success,
		).toBe(false);
		expect(
			AcquireHoldRequestSchema.safeParse({ ...base, ttlSeconds: 601 }).success,
		).toBe(false);
		expect(
			AcquireHoldRequestSchema.safeParse({ ...base, ttlSeconds: 600 }).success,
		).toBe(true);
	});

	it("(c) parses a hold.expired event with optional expiresAt", () => {
		const event: HoldEvent = HoldEventSchema.parse({
			type: "hold.expired",
			tenantId: "t1",
			resourceKey: "hold:appointment:t1:s1",
		});
		expect(event).toEqual({
			type: "hold.expired",
			tenantId: "t1",
			resourceKey: "hold:appointment:t1:s1",
		});
		expect(
			HoldEventSchema.parse({
				type: "hold.expired",
				tenantId: "t1",
				resourceKey: "hold:appointment:t1:s1",
				expiresAt: "2026-01-01T00:00:00.000Z",
			}).expiresAt,
		).toBe("2026-01-01T00:00:00.000Z");
	});

	it("(d) exposes the AvailableStock shape", () => {
		const stock: AvailableStock = {
			productId: "p1",
			stock: 10,
			held: 2,
			available: 8,
		};
		expect(stock.available).toBe(8);
	});
});
