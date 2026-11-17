import { readdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "bun:test";

// Patterns are assembled so this test file never literally contains the
// strings it forbids (the whole src tree, tests included, is scanned below).
const q = String.fromCharCode(34);
const forbidden = [
	`from ${q}node${":"}`,
	`@prisma${"/client"}`,
	`from ${q}express${q}`,
	`from ${q}@/`,
] as const;

const srcRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function collectTypeScriptFiles(dir: string, acc: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) collectTypeScriptFiles(full, acc);
		else if (entry.name.endsWith(".ts")) acc.push(full);
	}
	return acc;
}

describe("@neutra/commons is isomorphic", () => {
	it("does not import node builtins, Prisma, Express or the @/ alias", () => {
		const files = collectTypeScriptFiles(srcRoot);
		expect(files.length).toBeGreaterThan(0);

		const offenders: string[] = [];
		for (const file of files) {
			const source = readFileSync(file, "utf8");
			for (const pattern of forbidden) {
				if (source.includes(pattern)) offenders.push(`${file}: ${pattern}`);
			}
		}

		expect(offenders).toEqual([]);
	});
});
