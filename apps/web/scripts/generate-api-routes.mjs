/**
 * Generate the TanStack Start BFF server routes from the original Next API tree.
 *
 * Run from anywhere: `node scripts/generate-api-routes.mjs`.
 *
 * The script is the single source of truth for the generated files:
 *   - reads every `src/app/api/**\/route.ts`;
 *   - writes `scripts/api-routes.json` (normalized path + method inventory);
 *   - maps `[param]` folders to TanStack `$param` files;
 *   - turns `createGetHandler(...)`-style exports into `createBffHandler(...)`
 *     calls (and `createListWithStatsHandler` into its BFF twin);
 *   - references the Web-standard port of hand-rolled Next handlers through
 *     `webBffHandlers` (kept in `src/lib/api-route-handler.ts`);
 *   - writes `src/routes/api/**\/route.ts`.
 *
 * It deliberately does not delete `src/app/api` — that happens only after the
 * inventory test confirms the generated set matches the original set exactly.
 *
 * Most Next source files were removed after the migration, so the generated
 * files still on disk are the seed of the inventory: their route paths and
 * handler methods are re-read on every run, then the remaining source files
 * overlay (or add) their own entries. The manifest therefore reflects both
 * additions and deletions instead of preserving removed routes forever.
 *
 * The generation logic is exported so the inventory tests can run it against
 * a temporary copy of the tree; the CLI entry point keeps the defaults below.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const SOURCE_API = path.join(ROOT, "src/app/api");
const OUTPUT_API = path.join(ROOT, "src/routes/api");
const MANIFEST = path.join(HERE, "api-routes.json");

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

const FACTORY_METHODS = {
    createGetHandler: "GET",
    createPostHandler: "POST",
    createPutHandler: "PUT",
    createDeleteHandler: "DELETE",
    createPatchHandler: "PATCH",
};

/** Split a call's argument list on top-level commas, ignoring commas inside
 *  nested brackets or quoted/template strings. */
function splitArgs(source) {
    const parts = [];
    let depth = 0;
    let current = "";
    let quote = null;
    let escaped = false;

    for (const char of source) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }
        if (char === "\\") {
            current += char;
            escaped = true;
            continue;
        }
        if (quote) {
            current += char;
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === "`") {
            quote = char;
            current += char;
            continue;
        }
        if ("([{".includes(char)) depth += 1;
        if (")]}".includes(char)) depth -= 1;
        if (char === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
            continue;
        }
        current += char;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
}

/** Return the text between the parenthesis at `openIndex` and its match. */
function balancedCall(source, openIndex) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let i = openIndex; i < source.length; i += 1) {
        const char = source[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === "\\") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (char === quote) quote = null;
            continue;
        }
        if (char === '"' || char === "'" || char === "`") {
            quote = char;
            continue;
        }
        if (char === "(") depth += 1;
        if (char === ")") {
            depth -= 1;
            if (depth === 0) return source.slice(openIndex + 1, i);
        }
    }
    throw new Error(`Unbalanced call at offset ${openIndex}`);
}

/** Next's `req.nextUrl` has no Web equivalent; rewrite it to a URL parsed from
 *  the Web Request. The narrowed EndpointResolver now takes a plain Request. */
function toWebRequest(source) {
    return source
        .replace(
            /\b(\w+)\.nextUrl\.searchParams\b/g,
            "new URL($1.url).searchParams",
        )
        .replace(/\b(\w+)\.nextUrl\.search\b/g, "new URL($1.url).search")
        .replace(/\(\s*req\s*,\s*params\s*\)\s*=>/g, (_match) =>
            /\breq\./.test(source) ? _match : "(_req, params) =>",
        );
}

function normalizePathSegment(segment) {
    return segment.replace(/^\[(.+)\]$/, "$$$1");
}

async function routeFiles(dir) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
    }
    const files = await Promise.all(
        entries.map(async (entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return routeFiles(full);
            return entry.name === "route.ts" ? [full] : [];
        }),
    );
    return files.flat();
}

/** Rebuild a manifest entry from an already generated route file. Generated
 *  files carry the path in `createFileRoute(...)` and the exported methods
 *  under `server.handlers`, so they can be inventoried without their source. */
async function manifestEntryFromGenerated(file, outputApi) {
    const source = await readFile(file, "utf8");
    const route = source.match(
        /createFileRoute\(\s*["']([^"']+)["']\s*,?\s*\)/,
    );
    const segments = path
        .relative(outputApi, path.dirname(file))
        .split(path.sep)
        .filter(Boolean);
    const apiPath =
        route?.[1] ?? `/api${segments.length ? `/${segments.join("/")}` : ""}`;
    return {
        path: apiPath,
        methods: METHODS.filter((method) =>
            new RegExp(`(?:^|\\n)\\s*${method}\\s*:`, "m").test(source),
        ),
    };
}

function parseHandlers(source, apiPath) {
    const handlers = [];

    for (const method of METHODS) {
        // Hand-rolled `export async function GET(req: NextRequest) { ... }`.
        const inline = new RegExp(
            `export\\s+async\\s+function\\s+${method}\\s*\\(`,
        );
        if (inline.test(source)) {
            handlers.push({
                method,
                code: `webBffHandlers[${JSON.stringify(`${method} ${apiPath}`)}]`,
                kind: "web",
            });
            continue;
        }

        // Factory export: `export const GET = createGetHandler(...)`.
        const factory = new RegExp(
            `export\\s+const\\s+${method}\\s*=\\s*([\\w$]+)\\s*\\(`,
        );
        const match = source.match(factory);
        if (!match) continue;

        const factoryName = match[1];
        const openIndex = match.index + match[0].length - 1;
        const args = splitArgs(balancedCall(source, openIndex)).map(
            toWebRequest,
        );

        if (factoryName in FACTORY_METHODS) {
            const resolvedMethod = FACTORY_METHODS[factoryName];
            const endpoint = args[0];
            const config = args[1];
            handlers.push({
                method: resolvedMethod,
                code: `createBffHandler("${resolvedMethod}", ${endpoint}${
                    config ? `, ${config}` : ""
                })`,
                kind: "bff",
            });
        } else if (factoryName === "createListWithStatsHandler") {
            handlers.push({
                method,
                code: `createBffListWithStatsHandler(${args.join(", ")})`,
                kind: "list",
            });
        } else {
            throw new Error(
                `Unknown handler factory ${factoryName} in ${apiPath}`,
            );
        }
    }

    return handlers.sort(
        (a, b) => METHODS.indexOf(a.method) - METHODS.indexOf(b.method),
    );
}

function localEndpointDeclaration(source) {
    const match = source.match(
        /const\s+endpoint\s*:\s*EndpointResolver\s*=[\s\S]*?\n\};/,
    );
    return match ? match[0] : null;
}

function renderRoute({ apiPath, handlers, endpointDeclaration }) {
    const needsBff = handlers.some((handler) => handler.kind === "bff");
    const needsList = handlers.some((handler) => handler.kind === "list");
    const needsWeb = handlers.some((handler) => handler.kind === "web");

    const imports = [
        'import { createFileRoute } from "@tanstack/react-router";',
    ];
    const handlerImports = [];
    if (needsBff) handlerImports.push("createBffHandler");
    if (needsList) handlerImports.push("createBffListWithStatsHandler");
    if (needsWeb) handlerImports.push("webBffHandlers");
    if (endpointDeclaration) handlerImports.push("type EndpointResolver");
    imports.push(
        `import { ${handlerImports.join(", ")} } from "@/lib/api-route-handler";`,
    );

    const lines = [
        "// Generated by scripts/generate-api-routes.mjs — do not edit by hand.",
        ...imports,
        "",
    ];
    if (endpointDeclaration) {
        lines.push(endpointDeclaration, "");
    }
    lines.push(
        `export const Route = createFileRoute(${JSON.stringify(apiPath)})({`,
        "    server: {",
        "        handlers: {",
        ...handlers.map(
            (handler) => `            ${handler.method}: ${handler.code},`,
        ),
        "        },",
        "    },",
        "});",
        "",
    );
    return lines.join("\n");
}

export async function generateApiRoutes({
    sourceApi = SOURCE_API,
    outputApi = OUTPUT_API,
    manifestPath = MANIFEST,
    runFormatter = true,
} = {}) {
    const files = await routeFiles(sourceApi);
    if (files.length === 0) {
        throw new Error(`No route.ts files found under ${sourceApi}`);
    }

    // Most Next sources are gone, so the generated files still on disk are the
    // seed of the inventory: each contributes its path and handler methods.
    // The remaining sources overlay (or add) their own entries. Seeding from
    // disk rather than from the committed manifest lets regeneration record
    // deletions as well as additions.
    const generatedFiles = await routeFiles(outputApi);
    const generatedEntries = await Promise.all(
        generatedFiles.map((file) =>
            manifestEntryFromGenerated(file, outputApi),
        ),
    );
    const manifestByPath = new Map(
        generatedEntries.map((entry) => [entry.path, entry]),
    );
    const outputs = [];

    for (const file of files.sort()) {
        const source = await readFile(file, "utf8");
        const relative = path.relative(sourceApi, path.dirname(file));
        const segments = relative
            .split(path.sep)
            .filter(Boolean)
            .map(normalizePathSegment);
        const apiPath = `/api${segments.length ? `/${segments.join("/")}` : ""}`;
        const handlers = parseHandlers(source, apiPath);
        if (handlers.length === 0) {
            throw new Error(`No HTTP handlers found in ${file}`);
        }

        manifestByPath.set(apiPath, {
            path: apiPath,
            methods: handlers.map((h) => h.method),
        });
        const outputFile = path.join(outputApi, ...segments, "route.ts");
        outputs.push({
            file: outputFile,
            content: renderRoute({
                apiPath,
                handlers,
                endpointDeclaration: localEndpointDeclaration(source),
            }),
        });
    }

    const manifest = [...manifestByPath.values()].sort((a, b) =>
        a.path.localeCompare(b.path),
    );
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);

    for (const { file, content } of outputs) {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, content);
    }

    // The manifest is now seeded from the generated files themselves, so this
    // is only a safety net: keep source-backed files and anything still
    // recorded in the manifest, remove files absent from both.
    const keepFiles = new Set(outputs.map((entry) => entry.file));
    const keepPaths = new Set(manifest.map((entry) => entry.path));
    const generated = await routeFiles(outputApi);
    for (const file of generated) {
        const segments = path
            .relative(outputApi, path.dirname(file))
            .split(path.sep)
            .filter(Boolean);
        const apiPath = `/api${segments.length ? `/${segments.join("/")}` : ""}`;
        if (keepFiles.has(file) || keepPaths.has(apiPath)) continue;
        await rm(file);
    }

    // Keep regeneration idempotent with the repo's formatter.
    if (runFormatter) {
        execFileSync("npx", ["biome", "format", "--write", outputApi], {
            cwd: ROOT,
            stdio: "inherit",
        });
    }

    console.log(
        `Generated ${outputs.length} routes and ${manifest.length} manifest entries.`,
    );
    return manifest;
}

function main() {
    return generateApiRoutes();
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
