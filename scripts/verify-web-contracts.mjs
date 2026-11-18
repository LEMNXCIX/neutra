/**
 * Guard against re-introducing wire-contract definitions inside apps/web/src.
 *
 * @neutra/commons is the single source of truth for the HTTP envelope, error
 * details, wire enums and error codes. A definition of any of these in the web
 * app silently forks the contract, so this script fails when one appears.
 *
 * Scans every *.ts / *.tsx under apps/web/src (tests included — fixtures must
 * use the shared ErrorCodes catalog rather than hardcoded wire literals too).
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, "apps", "web", "src");

// Each entry is a forbidden definition. The label is used in the FAIL report.
const FORBIDDEN_DEFINITIONS = [
    { label: "interface StandardResponse", re: /\binterface\s+StandardResponse\b/g },
    { label: "interface ErrorDetail", re: /\binterface\s+ErrorDetail\b/g },
    { label: "enum AppointmentStatus", re: /\benum\s+AppointmentStatus\b/g },
    { label: "enum TenantType", re: /\benum\s+TenantType\b/g },
    { label: "enum CouponType", re: /\benum\s+CouponType\b/g },
    { label: "enum CategoryType", re: /\benum\s+CategoryType\b/g },
];

// Only the translation layer may map raw error codes, and it derives them from
// ErrorCodes; every other file must use the shared catalog too. This pattern
// deliberately requires the `code: "..."` form so that bare strings such as
// `["AUTH_SYNTHETIC_CODE"]` are not flagged.
const HARDCODED_ERROR_CODE = /\bcode\s*:\s*["'](?:AUTH_|VALIDATION_)/g;

const isErrorMessages = (file) => basename(file) === "error-messages.ts";

function lineOf(text, index) {
    let line = 1;
    for (let i = 0; i < index; i++) {
        if (text.charCodeAt(i) === 10) line++;
    }
    return line;
}

function collect(re, text, label, file) {
    const hits = [];
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(text)) !== null) {
        hits.push({
            file,
            line: lineOf(text, match.index),
            label,
            excerpt: text.slice(match.index, match.index + 60).split("\n")[0],
        });
    }
    return hits;
}

const files = readdirSync(srcDir, { recursive: true })
    .filter(
        (entry) =>
            typeof entry === "string" && /\.(ts|tsx)$/.test(entry),
    )
    .map((entry) => join(srcDir, entry));

const findings = [];
for (const file of files) {
    const rel = relative(root, file).split(sep).join("/");
    const text = readFileSync(file, "utf8");

    for (const { label, re } of FORBIDDEN_DEFINITIONS) {
        findings.push(...collect(re, text, label, rel));
    }
    if (!isErrorMessages(file)) {
        findings.push(
            ...collect(HARDCODED_ERROR_CODE, text, "hardcoded error code", rel),
        );
    }
}

if (findings.length > 0) {
    console.error(
        `FAIL: verify-web-contracts found ${findings.length} duplicated contract definition(s):`,
    );
    for (const { file, line, label, excerpt } of findings) {
        console.error(`  ${file}:${line}: ${label}: ${excerpt.trim()}`);
    }
    process.exit(1);
}

console.log(
    `PASS: verify-web-contracts — ${files.length} files scanned, 0 duplicated contract definitions`,
);
