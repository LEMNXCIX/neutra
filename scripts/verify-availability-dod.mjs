/**
 * Final DoD gate for the real-time availability / holds work (Task 9).
 *
 * Asserts the eight acceptance conditions from the spec:
 *   1. `holdKey` (runtime) and `HoldEvent` (TYPE) are exported by @neutra/commons;
 *   2. `withSlotLock` is declared on the appointment repository, implemented by
 *      the Prisma adapter and used by the create-appointment use case;
 *   3. `IHoldProvider` exposes a TTL-bearing `acquire` and `countActive`;
 *   4. `POST /api/holds` and `DELETE /api/holds/:key` are mounted in the API;
 *   5. the web SSE bridge is tenant-filtered and fed by the Redis subscriber;
 *   6. `IProductResponse` exposes `held` / `available` on both sides of the wire;
 *   7. zero literal `x-tenant-slug` headers in the new API source files;
 *   8. the monorepo working tree is clean.
 *
 * `HoldEvent` is a TYPE-only export: the runtime value is `HoldEventSchema`.
 * This gate therefore inspects source and emitted declarations instead of
 * importing `HoldEvent` at runtime (which would be undefined).
 *
 * Check 7 uses the fixed pre-availability commit 1337252 as its base so the
 * "new API files" set is stable. Check 8 intentionally depends on a committed
 * tree: commit the availability work before the final PASS re-run.
 *
 * Run from anywhere: every path is resolved relative to the monorepo root.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE_SHA = "1337252";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function indent(text) {
  return String(text).trim().split("\n").join("\n        ");
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

/** Read a root-relative file as UTF-8, with a precise message when missing. */
function source(relPath) {
  const path = join(root, relPath);
  assert(existsSync(path), `missing ${relPath}`);
  return readFileSync(path, "utf8");
}

/** Assert that `text` contains `re`, reporting the first matching line. */
function expectMatch(text, re, relPath, description) {
  const match = re.exec(text);
  assert(match, `${relPath}: expected ${description} (/${re.source}/)`);
  const line = text.slice(0, match.index).split("\n").length;
  return `${relPath}:${line}`;
}

/** Assert that `text` contains none of the `res`, reporting the first hit. */
function expectNoMatch(text, res, relPath, description) {
  for (const re of res) {
    const match = re.exec(text);
    assert(!match, `${relPath}: unexpected ${description} (/${re.source}/)`);
  }
}

const checks = [];
function check(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true });
    console.log(`  PASS  ${name}${detail ? `  [${detail}]` : ""}`);
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
    console.error(`  FAIL  ${name}\n        ${indent(error.message)}`);
  }
}

// 1. Commons exports holdKey (value) and HoldEvent (type) through its barrels.
check("commons exports holdKey (value) and HoldEvent (type)", () => {
  const hold = source("packages/commons/src/availability/hold.ts");
  const events = source("packages/commons/src/availability/events.ts");
  const barrel = source("packages/commons/src/availability/index.ts");
  const rootBarrel = source("packages/commons/src/index.ts");

  expectMatch(hold, /export function holdKey\(/, "packages/commons/src/availability/hold.ts", "holdKey function export");
  expectMatch(events, /export const HoldEventSchema\b/, "packages/commons/src/availability/events.ts", "HoldEventSchema runtime export");
  expectMatch(events, /export type HoldEvent\b/, "packages/commons/src/availability/events.ts", "HoldEvent type export");
  // HoldEvent must stay a type: importing it as a runtime value yields undefined.
  expectNoMatch(
    events,
    [/export\s+(?:const|let|var|function|class)\s+HoldEvent\b/],
    "packages/commons/src/availability/events.ts",
    "runtime HoldEvent value export",
  );
  expectMatch(barrel, /export \* from "\.\/events\.js"/, "packages/commons/src/availability/index.ts", "events barrel re-export");
  expectMatch(barrel, /export \* from "\.\/hold\.js"/, "packages/commons/src/availability/index.ts", "hold barrel re-export");
  expectMatch(rootBarrel, /export \* from "\.\/availability\/index\.js"/, "packages/commons/src/index.ts", "root availability re-export");

  // Emitted declarations are the contract consumers actually compile against.
  const builtHold = source("packages/commons/dist/availability/hold.d.ts");
  const builtEvents = source("packages/commons/dist/availability/events.d.ts");
  expectMatch(builtHold, /export declare function holdKey\(/, "packages/commons/dist/availability/hold.d.ts", "built holdKey declaration");
  expectMatch(builtEvents, /export type HoldEvent\b/, "packages/commons/dist/availability/events.d.ts", "built HoldEvent type declaration");
  return "type-only export verified (runtime value: HoldEventSchema)";
});

// 2. Transactional slot lock on the appointment repository, used by create.
check("withSlotLock on appointment repository and used by create", () => {
  const port = source("apps/api/core/repositories/appointment.repository.interface.ts");
  const adapter = source("apps/api/infrastructure/database/prisma/appointment.prisma-repository.ts");
  const create = source("apps/api/core/application/booking/create-appointment.use-case.ts");
  expectMatch(port, /withSlotLock\s*</, "apps/api/core/repositories/appointment.repository.interface.ts", "withSlotLock port declaration");
  expectMatch(adapter, /async withSlotLock\s*</, "apps/api/infrastructure/database/prisma/appointment.prisma-repository.ts", "withSlotLock adapter implementation");
  expectMatch(create, /\.withSlotLock\s*\(/, "apps/api/core/application/booking/create-appointment.use-case.ts", "withSlotLock call in create use case");
  return "port + adapter + create use case";
});

// 3. Generic hold port with native TTL and bulk active-hold counting.
check("IHoldProvider declares TTL acquire and countActive", () => {
  const port = source("apps/api/core/providers/hold-provider.interface.ts");
  const redis = source("apps/api/infrastructure/providers/redis-hold.provider.ts");
  expectMatch(port, /export interface IHoldProvider\s*\{/, "apps/api/core/providers/hold-provider.interface.ts", "IHoldProvider interface");
  expectMatch(port, /ttlSeconds:\s*number/, "apps/api/core/providers/hold-provider.interface.ts", "TTL-bearing acquire");
  expectMatch(port, /countActive\s*\(\s*keys:\s*string\[\]\s*\)/, "apps/api/core/providers/hold-provider.interface.ts", "countActive method");
  expectMatch(redis, /EX:\s*ttlSeconds/, "apps/api/infrastructure/providers/redis-hold.provider.ts", "native Redis TTL on acquire");
  expectMatch(redis, /async countActive\s*\(/, "apps/api/infrastructure/providers/redis-hold.provider.ts", "Redis countActive implementation");
  return "TTL + countActive in port and Redis adapter";
});

// 4. Hold routes mounted under /api/holds with POST and DELETE handlers.
check("POST and DELETE /api/holds are mounted in the API", () => {
  const routes = source("apps/api/infrastructure/routes/holds.routes.ts");
  const app = source("apps/api/app.ts");
  expectMatch(routes, /app\.use\(\s*["']\/api\/holds["']\s*,\s*router\s*\)/, "apps/api/infrastructure/routes/holds.routes.ts", 'app.use("/api/holds", router)');
  expectMatch(routes, /router\.post\s*\(/, "apps/api/infrastructure/routes/holds.routes.ts", "POST handler");
  expectMatch(routes, /router\.delete\s*\(/, "apps/api/infrastructure/routes/holds.routes.ts", "DELETE handler");
  expectMatch(app, /import holds from ["']@\/infrastructure\/routes\/holds\.routes["']/, "apps/api/app.ts", "holds route import");
  expectMatch(app, /holds\s*\(\s*app\s*,\s*controllers\.holds\s*\)/, "apps/api/app.ts", "holds(app, controllers.holds) mount");
  return "router + composition root";
});

// 5. Tenant-scoped SSE bridge fed by the shared Redis channel.
check("SSE bridge forwards only the caller's tenant HoldEvents", () => {
  const hub = source("apps/web/src/lib/availability-events.ts");
  const server = source("apps/web/src/server.ts");
  const subscriber = source("apps/web/src/lib/availability-subscriber.ts");
  expectMatch(hub, /createTenantEventHub<HoldEvent>\(\)/, "apps/web/src/lib/availability-events.ts", "tenant event hub");
  expectMatch(hub, /export function onAvailabilityEvent\(/, "apps/web/src/lib/availability-events.ts", "onAvailabilityEvent export");
  expectMatch(hub, /export function notifyAvailabilityEvent\(/, "apps/web/src/lib/availability-events.ts", "notifyAvailabilityEvent export");
  expectMatch(server, /onAvailabilityEvent\(\(event\)\s*=>/, "apps/web/src/server.ts", "SSE subscription");
  expectMatch(server, /event\.tenantId\s*!==\s*identity\.tenantId/, "apps/web/src/server.ts", "tenant filter on the SSE stream");
  expectMatch(subscriber, /HoldEventSchema\.parse\(/, "apps/web/src/lib/availability-subscriber.ts", "schema-validated Redis payload");
  expectMatch(subscriber, /notifyAvailabilityEvent\(/, "apps/web/src/lib/availability-subscriber.ts", "Redis -> hub forwarding");
  return "Redis subscriber -> tenant hub -> Host-scoped SSE";
});

// 6. Product availability fields on both the API DTO and the commons wire DTO.
check("IProductResponse exposes held and available", () => {
  const apiDto = source("apps/api/core/application/dtos/responses/product/product.response.ts");
  const wireDto = source("packages/commons/src/catalog/dtos/product.response.ts");
  expectMatch(apiDto, /export interface IProductResponse\s*\{/, "apps/api/core/application/dtos/responses/product/product.response.ts", "API IProductResponse");
  expectMatch(apiDto, /held:\s*number\s*;/, "apps/api/core/application/dtos/responses/product/product.response.ts", "API held field");
  expectMatch(apiDto, /available:\s*number\s*;/, "apps/api/core/application/dtos/responses/product/product.response.ts", "API available field");
  expectMatch(wireDto, /export type IProductResponse\b/, "packages/commons/src/catalog/dtos/product.response.ts", "commons IProductResponse");
  expectMatch(wireDto, /held:\s*z\.number\(\)\.optional\(\)/, "packages/commons/src/catalog/dtos/product.response.ts", "wire held field");
  expectMatch(wireDto, /available:\s*z\.number\(\)\.optional\(\)/, "packages/commons/src/catalog/dtos/product.response.ts", "wire available field");
  return "stock / held / available on both sides";
});

// 7. New API files derive tenant identity from the Host, not a client header.
// Scan explicit files instead of a git range: GitHub Actions uses a shallow
// checkout, so fixed BASE_SHAs are not present and `git diff <sha>..HEAD`
// fails even though the files are correct. The set below is the API source
// added by the availability feature and is stable regardless of clone depth.
const AVAILABILITY_API_SOURCES = [
  "apps/api/core/providers/hold-provider.interface.ts",
  "apps/api/infrastructure/providers/redis-hold.provider.ts",
  "apps/api/infrastructure/providers/redis-pubsub.provider.ts",
  "apps/api/infrastructure/routes/holds.routes.ts",
  "apps/api/interface-adapters/controllers/holds.controller.ts",
  "apps/api/core/application/availability/acquire-hold.use-case.ts",
  "apps/api/core/application/availability/release-hold.use-case.ts",
  "apps/api/middleware/hold-owner.middleware.ts",
];
check("0 literal x-tenant-slug in new API source files", () => {
  const files = AVAILABILITY_API_SOURCES.filter((file) => existsSync(join(root, file)));
  assert(files.length > 0, "no availability API source files found");
  const hits = [];
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    text.split(/\r?\n/).forEach((line, index) => {
      if (line.includes("x-tenant-slug")) hits.push(`${file}:${index + 1}:${line.trim()}`);
    });
  }
  assert(hits.length === 0, `${hits.length} literal(s) found:\n        ${hits.slice(0, 10).join("\n        ")}`);
  return `${files.length} new API files scanned`;
});

// 8. Clean monorepo working tree (commit the work before the final re-run).
check("monorepo git status is clean", () => {
  const status = git(["status", "--porcelain"]);
  assert(status.trim() === "", `working tree is dirty:\n        ${indent(status)}`);
});

const failed = checks.filter((c) => !c.ok);
console.log(`\nverify-availability-dod: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length) {
  console.error(`FAIL: availability DoD gate failed (${failed.length} check(s))`);
  process.exit(1);
}
console.log("PASS: availability DoD gate succeeded");
