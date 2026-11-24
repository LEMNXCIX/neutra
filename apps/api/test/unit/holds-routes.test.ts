import {
	AcquireHoldRequestSchema,
	holdKey,
	ResourceErrorCodes,
	type HoldEvent,
} from "@neutra/commons";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { AcquireHoldUseCase } from "@/core/application/availability/acquire-hold.use-case";
import { ReleaseHoldUseCase } from "@/core/application/availability/release-hold.use-case";
import type { IEventBus } from "@/core/providers/event-bus.interface";
import type { IHoldProvider } from "@/core/providers/hold-provider.interface";
import type { ILogger } from "@/core/providers/logger.interface";
import holds from "@/infrastructure/routes/holds.routes";
import {
	type HoldRedisClient,
	RedisHoldProvider,
} from "@/infrastructure/providers/redis-hold.provider";
import { HoldsController } from "@/interface-adapters/controllers/holds.controller";
import { createErrorMiddleware } from "@/middleware/error.middleware";
import createResponseMiddleware from "@/middleware/response.middleware";

type SetOptions = { EX?: number; NX?: boolean };
type Stored = { value: string; expiresAt: number };

/** In-memory Redis stand-in enforcing NX/EX, like the hold provider unit test. */
function createFakeRedis(): HoldRedisClient {
	const store = new Map<string, Stored>();
	const prune = (key: string) => {
		const entry = store.get(key);
		if (entry && entry.expiresAt <= Date.now()) store.delete(key);
	};
	return {
		set: async (key: string, value: string, opts?: SetOptions) => {
			prune(key);
			if (opts?.NX && store.has(key)) return null;
			store.set(key, {
				value,
				expiresAt: opts?.EX
					? Date.now() + opts.EX * 1000
					: Number.POSITIVE_INFINITY,
			});
			return "OK";
		},
		get: async (key: string) => {
			prune(key);
			return store.get(key)?.value ?? null;
		},
		del: async (key: string) => {
			prune(key);
			return store.delete(key) ? 1 : 0;
		},
		mGet: async (keys: string[]) =>
			keys.map((key) => {
				prune(key);
				return store.get(key)?.value ?? null;
			}),
	};
}

const logger = {
	info: jest.fn(),
	warn: jest.fn(),
	error: jest.fn(),
	debug: jest.fn(),
	logRequest: jest.fn(),
	logResponse: jest.fn(),
} as unknown as ILogger;

function buildApp(hold: IHoldProvider, eventBus: IEventBus) {
	const app = express();
	app.use(express.json());
	app.use(cookieParser());
	app.use(createResponseMiddleware(logger));
	// Stand-in for tenantMiddleware: tenant identity comes from the Host only.
	app.use((req: Request, _res: Response, next: NextFunction) => {
		req.tenantId = req.hostname.split(".")[0];
		next();
	});
	const controller = new HoldsController(
		new AcquireHoldUseCase(hold, eventBus),
		new ReleaseHoldUseCase(hold, eventBus),
	);
	holds(app, controller);
	app.use(createErrorMiddleware(logger));
	return app;
}

const acquireBody = (resourceId: string) => ({
	// The body tenantId is deliberately spoofed: routes must ignore it.
	resourceType: "appointment",
	tenantId: "spoofed-tenant",
	resourceId,
	ttlSeconds: 60,
});

function setCookiesOf(response: request.Response): string[] {
	const raw = response.headers["set-cookie"];
	return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

function ownerCookieOf(response: request.Response): string {
	const cookie = setCookiesOf(response).find((value) =>
		value.startsWith("hold_owner="),
	);
	if (!cookie) throw new Error("hold_owner cookie missing");
	return cookie.split(";")[0];
}

/** Unit app has the response envelope; a bare route app does not. */
function dataOf(response: request.Response) {
	return response.body.data ?? response.body;
}

describe("holds routes", () => {
	let hold: IHoldProvider;
	let eventBus: { publish: jest.Mock<Promise<void>, [HoldEvent]> };
	let app: ReturnType<typeof buildApp>;

	beforeEach(() => {
		hold = new RedisHoldProvider(createFakeRedis());
		eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
		app = buildApp(hold, eventBus);
	});

	it("acquires a hold, sets the hold_owner cookie and publishes hold.acquired", async () => {
		const response = await request(app)
			.post("/api/holds")
			.set("Host", "acme.localhost")
			.send(acquireBody("slot-1"))
			.expect(201);

		const key = holdKey("appointment", "acme", "slot-1");
		expect(dataOf(response).key).toBe(key);
		expect(new Date(dataOf(response).expiresAt).toISOString()).toBe(
			dataOf(response).expiresAt,
		);
		const cookie = ownerCookieOf(response);
		expect(cookie).toMatch(/^hold_owner=[0-9a-f-]{36}$/);
		const setCookie = setCookiesOf(response).find((value) =>
			value.startsWith("hold_owner="),
		) as string;
		expect(setCookie).toMatch(/HttpOnly/i);
		expect(setCookie).toMatch(/SameSite=Lax/i);
		expect(setCookie).toMatch(/Max-Age=604800/i);
		expect(eventBus.publish).toHaveBeenCalledWith({
			type: "hold.acquired",
			tenantId: "acme",
			resourceKey: key,
			expiresAt: dataOf(response).expiresAt,
		});
	});

	it("reuses the cookie across holds and releases only for the owning cookie", async () => {
		const first = await request(app)
			.post("/api/holds")
			.set("Host", "acme.localhost")
			.send(acquireBody("slot-1"))
			.expect(201);
		const owner = ownerCookieOf(first);

		const second = await request(app)
			.post("/api/holds")
			.set("Host", "acme.localhost")
			.set("Cookie", owner)
			.send({
				...acquireBody("product-1"),
				resourceType: "product",
			})
			.expect(201);
		// The existing cookie is reused: no second Set-Cookie is emitted.
		expect(second.headers["set-cookie"]).toBeUndefined();
		expect(dataOf(second).key).toBe(
			holdKey("product", "acme", "product-1"),
		);

		const wrongOwner = await request(app)
			.delete(`/api/holds/${encodeURIComponent(dataOf(first).key)}`)
			.set("Host", "acme.localhost")
			.set("Cookie", "hold_owner=someone-else")
			.expect(200);
		expect(dataOf(wrongOwner)).toEqual({ released: false });
		expect(eventBus.publish).not.toHaveBeenCalledWith(
			expect.objectContaining({ type: "hold.released" }),
		);

		const rightOwner = await request(app)
			.delete(`/api/holds/${encodeURIComponent(dataOf(first).key)}`)
			.set("Host", "acme.localhost")
			.set("Cookie", owner)
			.expect(200);
		expect(dataOf(rightOwner)).toEqual({ released: true });
		expect(eventBus.publish).toHaveBeenCalledWith({
			type: "hold.released",
			tenantId: "acme",
			resourceKey: dataOf(first).key,
		});
		await expect(hold.countActive([dataOf(second).key])).resolves.toEqual({
			[dataOf(second).key]: 1,
		});
	});

	it("returns 409 and publishes nothing when the key is already held", async () => {
		await request(app)
			.post("/api/holds")
			.set("Host", "acme.localhost")
			.send(acquireBody("slot-1"))
			.expect(201);
		const callsBefore = eventBus.publish.mock.calls.length;

		const conflict = await request(app)
			.post("/api/holds")
			.set("Host", "acme.localhost")
			.set("Cookie", "hold_owner=other-owner")
			.send(acquireBody("slot-1"));

		expect(conflict.status).toBe(409);
		expect(conflict.body.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: ResourceErrorCodes.CONFLICT }),
			]),
		);
		expect(eventBus.publish).toHaveBeenCalledTimes(callsBefore);
	});

	it("does not release a key scoped to another tenant", async () => {
		const foreignKey = holdKey("appointment", "other-tenant", "slot-1");
		const response = await request(app)
			.delete(`/api/holds/${encodeURIComponent(foreignKey)}`)
			.set("Host", "acme.localhost")
			.set("Cookie", "hold_owner=any-owner")
			.expect(200);

		expect(dataOf(response)).toEqual({ released: false });
		expect(eventBus.publish).not.toHaveBeenCalled();
	});

	it("validates the request body before acquiring", async () => {
		expect(AcquireHoldRequestSchema.safeParse(acquireBody("slot-1")).success).toBe(
			true,
		);
		const response = await request(app)
			.post("/api/holds")
			.set("Host", "acme.localhost")
			.send({ ...acquireBody("slot-1"), ttlSeconds: 601 });

		expect(response.status).toBe(400);
		expect(eventBus.publish).not.toHaveBeenCalled();
	});
});
