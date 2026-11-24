/**
 * Final acceptance gate for the deferred-debt remediation plan (Task 9).
 *
 * Asserts the eight criteria from the remediation spec, one per remediated
 * debt / task:
 *   1. no `passport-twitter` in any package.json or the lockfile, and no
 *      `xmldom` advisory in `bun audit --json`;
 *   2. `TENANT_TRUST_HOST_ONLY` present in config, enforced by the tenant
 *      middleware, and documented in CI as production-only (never enabled);
 *   3. `CANCELADO` in the schema, commons enum, statuses use case (plus the
 *      transition policy/use case) and an idempotent migration;
 *   4. `hold.expired` published by the dedicated Redis subscriber, started by
 *      the runtime, with `notify-keyspace-events Ex` in both compose files;
 *   5. `runtime.close()` closing server, all Redis clients, workers and queues,
 *      wired to SIGTERM/SIGINT in the entrypoint;
 *   6. `ProductResponse.fromEntity` defaulting `available` to `product.stock`,
 *      with the web consuming `IProductResponse` from @neutra/commons and no
 *      local `ProductStock` type;
 *   7. the route generator seeding its manifest from files on disk rather than
 *      from the committed `api-routes.json`;
 *   8. a clean monorepo working tree.
 *
 * Check 1 tolerates `bun audit --json` exiting 1 (that is how Bun reports the
 * accepted, non-blocking advisories) and only inspects its output. Check 8
 * intentionally depends on a committed tree: commit the work before the final
 * PASS re-run.
 *
 * Run from anywhere: every path is resolved relative to the monorepo root.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".jest-cache",
  ".output",
  ".git",
  "coverage",
  ".tanstack",
]);

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
  return `${relPath}:${text.slice(0, match.index).split("\n").length}`;
}

/** Assert that `text` contains none of the `res`, reporting the first hit. */
function expectNoMatch(text, res, relPath, description) {
  for (const re of res) {
    const match = re.exec(text);
    assert(!match, `${relPath}: unexpected ${description} (/${re.source}/)`);
  }
}

/** Run a command, capturing stdout even when the command exits non-zero. */
function runCapture(cmd, args) {
  try {
    return {
      ok: true,
      stdout: execFileSync(cmd, args, {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
      stderr: "",
    };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout ? String(error.stdout) : "",
      stderr: error.stderr ? String(error.stderr) : "",
      error: error.message,
    };
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

// 1. Twitter OAuth and its vulnerable xmldom dependency are gone.
check("no passport-twitter in package.json/bun.lock; 0 xmldom advisories", () => {
  const packageFiles = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const target = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.name === "package.json") packageFiles.push(target);
    }
  }
  assert(packageFiles.length > 0, "no package.json files found");
  const declared = packageFiles
    .filter((file) => /passport-twitter/.test(readFileSync(file, "utf8")))
    .map((file) => relative(root, file));
  assert(
    declared.length === 0,
    `passport-twitter still declared in: ${declared.join(", ")}`,
  );

  const lock = source("bun.lock");
  expectNoMatch(
    lock,
    [/passport-twitter/, /xmldom@0\.1\.31/],
    "bun.lock",
    "removed dependency",
  );

  // Bun exits 1 whenever advisories exist; that is not a verifier failure.
  const audit = runCapture("bun", ["audit", "--json"]);
  assert(
    audit.stdout.trim().length > 0,
    `bun audit --json produced no output: ${indent(audit.error || audit.stderr)}`,
  );
  let advisories;
  try {
    advisories = JSON.parse(audit.stdout);
  } catch (error) {
    throw new Error(`bun audit --json output is not JSON: ${error.message}`);
  }
  assert(
    advisories && typeof advisories === "object" && !Array.isArray(advisories),
    "unexpected bun audit --json shape (expected object keyed by package)",
  );
  const xmldomKeys = Object.keys(advisories).filter((name) =>
    /xmldom/i.test(name),
  );
  assert(
    xmldomKeys.length === 0,
    `xmldom advisories found: ${xmldomKeys.join(", ")}`,
  );
  const mentions = (audit.stdout.match(/xmldom/gi) || []).length;
  assert(mentions === 0, `bun audit --json mentions xmldom ${mentions} time(s)`);
  const total = Object.values(advisories).reduce(
    (sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0),
    0,
  );
  return `${total} advisories total, 0 xmldom`;
});

// 2. Host-only tenant resolution is wired and production-only in CI.
check("TENANT_TRUST_HOST_ONLY in config, middleware and CI", () => {
  const config = source("apps/api/config/index.config.ts");
  expectMatch(
    config,
    /tenantTrustHostOnly:\s*process\.env\.TENANT_TRUST_HOST_ONLY\s*===\s*["']true["']/,
    "apps/api/config/index.config.ts",
    "tenantTrustHostOnly flag (default false)",
  );
  const middleware = source("apps/api/middleware/tenant.middleware.ts");
  expectMatch(
    middleware,
    /config\.tenantTrustHostOnly/,
    "apps/api/middleware/tenant.middleware.ts",
    "host-only branch guarding headers/cookies",
  );
  const ci = source(".github/workflows/CI.yml");
  expectMatch(
    ci,
    /TENANT_TRUST_HOST_ONLY/,
    ".github/workflows/CI.yml",
    "production-only note",
  );
  expectNoMatch(
    ci,
    [/^\s*TENANT_TRUST_HOST_ONLY\s*:\s*["']?true["']?\s*$/m],
    ".github/workflows/CI.yml",
    "flag enabled in CI (would break header-based integration suites)",
  );
  return "default false, enforced by middleware, not enabled in CI";
});

// 3. CANCELADO is a first-class order status with an idempotent migration.
check("CANCELADO in schema, commons enum, statuses and migration", () => {
  const schema = source("apps/api/prisma/schema.prisma");
  expectMatch(schema, /\bCANCELADO\b/, "apps/api/prisma/schema.prisma", "enum value");
  const orderEnum = source("packages/commons/src/enums/order.ts");
  expectMatch(
    orderEnum,
    /CANCELADO:\s*["']CANCELADO["']/,
    "packages/commons/src/enums/order.ts",
    "commons enum value",
  );
  const statuses = source(
    "apps/api/core/application/order/get-order-statuses.use-case.ts",
  );
  expectMatch(
    statuses,
    /value:\s*["']CANCELADO["']/,
    "apps/api/core/application/order/get-order-statuses.use-case.ts",
    "exposed status",
  );
  const policy = source("apps/api/core/domain/order/order.policy.ts");
  expectMatch(
    policy,
    /PENDIENTE:\s*\[[^\]]*CANCELADO/,
    "apps/api/core/domain/order/order.policy.ts",
    "PENDIENTE -> CANCELADO transition",
  );
  const changeStatus = source(
    "apps/api/core/application/order/change-order-status.use-case.ts",
  );
  expectMatch(
    changeStatus,
    /["']CANCELADO["']/,
    "apps/api/core/application/order/change-order-status.use-case.ts",
    "accepted target status",
  );

  const migrationsDir = join(root, "apps", "api", "prisma", "migrations");
  assert(existsSync(migrationsDir), "missing apps/api/prisma/migrations");
  const migrations = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /cancelado/i.test(entry.name))
    .map((entry) => entry.name);
  assert(
    migrations.length >= 1,
    "no add_order_status_cancelado migration directory found",
  );
  const sqlPath = `apps/api/prisma/migrations/${migrations[0]}/migration.sql`;
  const sql = source(sqlPath);
  expectMatch(
    sql,
    /ADD VALUE\s+["']CANCELADO["']/,
    sqlPath,
    "ALTER TYPE ADD VALUE CANCELADO",
  );
  expectMatch(
    sql,
    /duplicate_object/,
    sqlPath,
    "idempotent duplicate_object guard",
  );
  return migrations[0];
});

// 4. Redis key expiry produces typed hold.expired events.
check("hold.expired published by subscriber; keyspace Ex in compose", () => {
  const subscriber = source(
    "apps/api/infrastructure/providers/redis-expiry-subscriber.ts",
  );
  expectMatch(
    subscriber,
    /type:\s*["']hold\.expired["']/,
    "apps/api/infrastructure/providers/redis-expiry-subscriber.ts",
    'published event type "hold.expired"',
  );
  expectMatch(
    subscriber,
    /subscribe\(\s*HOLD_EXPIRED_CHANNEL/,
    "apps/api/infrastructure/providers/redis-expiry-subscriber.ts",
    "expired-keyspace subscription",
  );
  expectMatch(
    subscriber,
    /configSet\(\s*["']notify-keyspace-events["']\s*,\s*["']Ex["']\s*\)/,
    "apps/api/infrastructure/providers/redis-expiry-subscriber.ts",
    "Ex notifications enabled on connect",
  );
  const runtime = source("apps/api/infrastructure/config/runtime.ts");
  expectMatch(
    runtime,
    /startHoldExpirySubscriber\(/,
    "apps/api/infrastructure/config/runtime.ts",
    "subscriber wired into the runtime",
  );
  const app = source("apps/api/app.ts");
  expectMatch(
    app,
    /runtime\.startHoldExpiry\(\)/,
    "apps/api/app.ts",
    "subscriber started at boot",
  );
  for (const compose of [
    "apps/api/docker-compose.yml",
    "apps/api/docker-compose.prod.yml",
  ]) {
    expectMatch(
      source(compose),
      /notify-keyspace-events[^\n]*\bEx\b/,
      compose,
      "redis-server started with keyspace Ex events",
    );
  }
  return "subscriber + both compose files";
});

// 5. Shutdown drains every resource on SIGTERM/SIGINT.
check("runtime.close() wired to SIGTERM/SIGINT", () => {
  const runtime = source("apps/api/infrastructure/config/runtime.ts");
  expectMatch(
    runtime,
    /const close\s*=\s*\(\)\s*:\s*Promise<void>/,
    "apps/api/infrastructure/config/runtime.ts",
    "close() implementation",
  );
  for (const [re, description] of [
    [/server\.close\(/, "HTTP server close"],
    [/providers\.cache\.quit\(\)/, "cache Redis quit"],
    [/availabilityClient\.quit\(\)/, "availability Redis quit"],
    [/holdExpiryClient\.quit\(\)/, "hold-expiry Redis quit"],
    [/worker\.close\(\)/, "worker close"],
    [/queue\.close\(\)/, "queue close"],
    [/^\s*close,\s*$/m, "close exported by the runtime"],
  ]) {
    expectMatch(
      runtime,
      re,
      "apps/api/infrastructure/config/runtime.ts",
      description,
    );
  }
  const app = source("apps/api/app.ts");
  for (const signal of ["SIGTERM", "SIGINT"]) {
    expectMatch(
      app,
      new RegExp(`process\\.once\\(\\s*["']${signal}["']\\s*,\\s*shutdown\\s*\\)`),
      "apps/api/app.ts",
      `${signal} handler`,
    );
  }
  expectMatch(
    app,
    /runtime\s*\.\s*close\s*\(\s*\)/,
    "apps/api/app.ts",
    "shutdown calls runtime.close()",
  );
  source("apps/api/test/unit/graceful-shutdown.test.ts");
  return "server + 3 Redis clients + workers + queues";
});

// 6. Stock defaults and shared web product types.
check("available defaults to product.stock; no local ProductStock in web", () => {
  const dto = source(
    "apps/api/core/application/dtos/responses/product/product.response.ts",
  );
  expectMatch(
    dto,
    /available\s*=\s*product\.stock/,
    "apps/api/core/application/dtos/responses/product/product.response.ts",
    "available defaulting to full stock",
  );
  const hook = source("apps/web/src/hooks/use-product-availability.ts");
  expectMatch(
    hook,
    /import\s*\{[^}]*\bIProductResponse\b[^}]*\}\s*from\s*["']@neutra\/commons["']/,
    "apps/web/src/hooks/use-product-availability.ts",
    "IProductResponse imported from @neutra/commons",
  );
  expectNoMatch(
    hook,
    [/\bProductStock\b/],
    "apps/web/src/hooks/use-product-availability.ts",
    "local ProductStock type/cast",
  );
  const service = source("apps/web/src/services/products.service.ts");
  expectMatch(
    service,
    /Pick<\s*IProductResponse\s*,\s*["']stock["']\s*\|\s*["']held["']\s*\|\s*["']available["']\s*>/,
    "apps/web/src/services/products.service.ts",
    "getById typed with the shared Pick",
  );
  return "commons DTO consumed without local casts";
});

// 7. The route manifest is regenerated from disk, not seeded from its old copy.
check("route generator seeds manifest from disk, not api-routes.json", () => {
  const generator = source("apps/web/scripts/generate-api-routes.mjs");
  expectMatch(
    generator,
    /const generatedFiles\s*=\s*await routeFiles\(outputApi\)/,
    "apps/web/scripts/generate-api-routes.mjs",
    "generated route files enumerated from disk",
  );
  expectMatch(
    generator,
    /manifestByPath\s*=\s*new Map\(\s*generatedEntries/,
    "apps/web/scripts/generate-api-routes.mjs",
    "manifest built from on-disk entries",
  );
  expectNoMatch(
    generator,
    [
      /readFile\(\s*MANIFEST\s*\)/,
      /readFile\(\s*manifestPath\b/,
      /readFileSync\(\s*MANIFEST\s*\)/,
      /readFileSync\(\s*manifestPath\b/,
    ],
    "apps/web/scripts/generate-api-routes.mjs",
    "committed manifest used as a seed",
  );
  return "deleted generated routes shrink the manifest";
});

// 8. Clean monorepo working tree (commit the work before the final re-run).
check("monorepo git status is clean", () => {
  const status = git(["status", "--porcelain"]);
  assert(
    status.trim() === "",
    `working tree is dirty:\n        ${indent(status)}`,
  );
});

const failed = checks.filter((c) => !c.ok);
console.log(
  `\nverify-debt-remediation: ${checks.length - failed.length}/${checks.length} checks passed`,
);
if (failed.length) {
  console.error(`FAIL: debt remediation gate failed (${failed.length} check(s))`);
  process.exit(1);
}
console.log("PASS: debt remediation gate succeeded");
