import {
    cpSync,
    existsSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { generateApiRoutes } from "../../../../scripts/generate-api-routes.mjs";

const ROOT = resolve(__dirname, "../../../..");
const MANIFEST_PATH = join(ROOT, "scripts/api-routes.json");
const GENERATED_API_DIR = join(ROOT, "src/routes/api");
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

type RouteEntry = { path: string; methods: string[] };

/** A path+method tuple is the unit of parity the inventory guards. Dynamic
 *  segments are normalised to TanStack's `$param` form on both sides. */
type RouteKey = string;

const key = (method: string, path: string): RouteKey => `${method} ${path}`;

/** Ground truth for the migration: the 79 routes (75 original, two admin logs
 *  and two holds) with all 125 of their path+method pairs. Kept explicit so a
 *  parity assertion cannot pass by comparing the manifest to itself. */
const EXPECTED_ROUTE_KEYS: readonly RouteKey[] = [
    "DELETE /api/admin/banners/$id",
    "DELETE /api/admin/categories/$id",
    "DELETE /api/admin/coupons/$id",
    "DELETE /api/admin/orders/$id",
    "DELETE /api/admin/products/$id",
    "DELETE /api/admin/sliders/$id",
    "DELETE /api/appointments/$id",
    "DELETE /api/cart/clear",
    "DELETE /api/categories/$id",
    "DELETE /api/features/$id",
    "DELETE /api/holds/$key",
    "DELETE /api/loyalty/admin/campaigns/$campaignId",
    "DELETE /api/permissions/$id",
    "DELETE /api/products/$id",
    "DELETE /api/roles/$id",
    "DELETE /api/services/$id",
    "DELETE /api/staff/$id",
    "DELETE /api/users/$id",
    "GET /api/admin/banners",
    "GET /api/admin/categories",
    "GET /api/admin/coupons",
    "GET /api/admin/logs",
    "GET /api/admin/logs/stats",
    "GET /api/admin/orders",
    "GET /api/admin/orders/$id",
    "GET /api/admin/orders/statuses",
    "GET /api/admin/products",
    "GET /api/admin/sliders",
    "GET /api/admin/stats/overview",
    "GET /api/admin/users",
    "GET /api/appointments",
    "GET /api/appointments/$id",
    "GET /api/appointments/availability",
    "GET /api/auth/me",
    "GET /api/auth/validate",
    "GET /api/banners",
    "GET /api/cart",
    "GET /api/cart/stats",
    "GET /api/categories",
    "GET /api/categories/$id",
    "GET /api/features",
    "GET /api/features/$id",
    "GET /api/loyalty/admin/campaigns",
    "GET /api/loyalty/admin/campaigns/$campaignId",
    "GET /api/loyalty/admin/summary",
    "GET /api/loyalty/admin/tenants",
    "GET /api/loyalty/me",
    "GET /api/loyalty/me/campaigns/$campaignId",
    "GET /api/orders",
    "GET /api/orders/$id",
    "GET /api/orders/statuses",
    "GET /api/orders/user",
    "GET /api/permissions",
    "GET /api/permissions/$id",
    "GET /api/products",
    "GET /api/products/$id",
    "GET /api/profile",
    "GET /api/roles",
    "GET /api/roles/$id",
    "GET /api/services",
    "GET /api/sliders",
    "GET /api/staff",
    "GET /api/staff/me",
    "GET /api/tenants",
    "GET /api/tenants/$id",
    "GET /api/tenants/$id/features",
    "GET /api/tenants/config/$slug",
    "GET /api/tenants/mine",
    "GET /api/users",
    "GET /api/users/$id",
    "GET /api/users/stats",
    "PATCH /api/loyalty/admin/campaigns/$campaignId",
    "POST /api/admin/banners",
    "POST /api/admin/categories",
    "POST /api/admin/coupons",
    "POST /api/admin/orders",
    "POST /api/admin/products",
    "POST /api/admin/sliders",
    "POST /api/appointments",
    "POST /api/auth/forgot-password",
    "POST /api/auth/login",
    "POST /api/auth/logout",
    "POST /api/auth/register",
    "POST /api/auth/reset-password",
    "POST /api/banners",
    "POST /api/cart/add",
    "POST /api/categories",
    "POST /api/features",
    "POST /api/holds",
    "POST /api/loyalty/admin/campaigns",
    "POST /api/loyalty/admin/campaigns/$campaignId/activate",
    "POST /api/loyalty/admin/campaigns/$campaignId/archive",
    "POST /api/loyalty/admin/campaigns/$campaignId/end",
    "POST /api/loyalty/me/campaigns/$campaignId/claim",
    "POST /api/orders",
    "POST /api/permissions",
    "POST /api/products",
    "POST /api/revalidate",
    "POST /api/roles",
    "POST /api/services",
    "POST /api/staff",
    "POST /api/tenants",
    "PUT /api/admin/banners/$id",
    "PUT /api/admin/categories/$id",
    "PUT /api/admin/coupons/$id",
    "PUT /api/admin/orders/$id",
    "PUT /api/admin/products/$id",
    "PUT /api/admin/sliders/$id",
    "PUT /api/admin/users",
    "PUT /api/appointments/$id/cancel",
    "PUT /api/appointments/$id/status",
    "PUT /api/cart/remove",
    "PUT /api/categories/$id",
    "PUT /api/features/$id",
    "PUT /api/permissions/$id",
    "PUT /api/products/$id",
    "PUT /api/profile",
    "PUT /api/roles/$id",
    "PUT /api/services/$id",
    "PUT /api/staff/$id",
    "PUT /api/staff/$id/services",
    "PUT /api/tenants/$id",
    "PUT /api/tenants/$id/features",
    "PUT /api/users/$id",
    "PUT /api/users/$id/role",
];

const EXPECTED_ROUTE_COUNT = new Set(
    EXPECTED_ROUTE_KEYS.map((routeKey) =>
        routeKey.slice(routeKey.indexOf(" ") + 1),
    ),
).size;

function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory() ? walk(full) : [full];
    });
}

function readManifest(): RouteEntry[] {
    if (!existsSync(MANIFEST_PATH)) return [];
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as RouteEntry[];
}

function manifestKeys(): Set<RouteKey> {
    const keys = new Set<RouteKey>();
    for (const entry of readManifest()) {
        for (const method of entry.methods) keys.add(key(method, entry.path));
    }
    return keys;
}

/** Read the generated route files the same way a reviewer would: parse the
 *  `createFileRoute('/api/...')` path and the method names under server.handlers. */
function generatedFiles(): string[] {
    return walk(GENERATED_API_DIR).filter(
        (file) => file.endsWith("route.ts") && !file.includes("__tests__"),
    );
}

function generatedKeys(): Set<RouteKey> {
    const keys = new Set<RouteKey>();
    for (const file of generatedFiles()) {
        const source = readFileSync(file, "utf8");
        const match = source.match(
            /createFileRoute\(\s*["']([^"']+)["']\s*,?\s*\)/,
        );
        if (!match) continue;
        const path = match[1];
        for (const method of METHODS) {
            const handler = new RegExp(`(?:^|\\n)\\s*${method}\\s*:`, "m");
            if (handler.test(source)) keys.add(key(method, path));
        }
    }
    return keys;
}

describe("generated API route inventory", () => {
    it("generates one route file per expected route", () => {
        expect(generatedFiles()).toHaveLength(EXPECTED_ROUTE_COUNT);
    });

    it("records the original 75 routes, two admin logs routes and two hold routes", () => {
        expect(EXPECTED_ROUTE_COUNT).toBe(79);
        expect(readManifest()).toHaveLength(EXPECTED_ROUTE_COUNT);
    });

    it("matches the original path+method set exactly", () => {
        expect(EXPECTED_ROUTE_KEYS).toHaveLength(125);
        expect([...generatedKeys()].sort()).toEqual(
            [...EXPECTED_ROUTE_KEYS].sort(),
        );
        expect([...manifestKeys()].sort()).toEqual(
            [...EXPECTED_ROUTE_KEYS].sort(),
        );
    });

    it("uses TanStack $param files, never Next [param] folders", () => {
        const offenders = generatedFiles().filter((file) => file.includes("["));
        expect(offenders).toEqual([]);
    });

    it("every generated file exports a file route with server handlers", () => {
        for (const file of generatedFiles()) {
            const source = readFileSync(file, "utf8");
            expect(source).toMatch(/export const Route = createFileRoute\(/);
            expect(source).toMatch(/server:\s*\{/);
            expect(source).toMatch(/handlers:\s*\{/);
        }
    });

    it("shrinks the manifest when a generated route is removed from disk", async () => {
        const sandbox = mkdtempSync(join(tmpdir(), "neutra-route-inventory-"));
        try {
            const sourceApi = join(sandbox, "src/app/api");
            const outputApi = join(sandbox, "src/routes/api");
            const manifestPath = join(sandbox, "scripts/api-routes.json");
            cpSync(join(ROOT, "src/app/api"), sourceApi, { recursive: true });
            cpSync(GENERATED_API_DIR, outputApi, { recursive: true });
            cpSync(MANIFEST_PATH, manifestPath);

            const before = JSON.parse(
                readFileSync(manifestPath, "utf8"),
            ) as RouteEntry[];
            expect(before).toHaveLength(79);

            // No source file backs this generated route, so regeneration must
            // drop its manifest entry once the file disappears from disk.
            rmSync(join(outputApi, "admin/banners/route.ts"));

            await generateApiRoutes({
                sourceApi,
                outputApi,
                manifestPath,
                runFormatter: false,
            });

            const after = JSON.parse(
                readFileSync(manifestPath, "utf8"),
            ) as RouteEntry[];
            expect(after).toHaveLength(78);
            expect(after.map((entry) => entry.path)).not.toContain(
                "/api/admin/banners",
            );
        } finally {
            rmSync(sandbox, { recursive: true, force: true });
        }
    });
});
