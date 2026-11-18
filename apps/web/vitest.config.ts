import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        globals: true,
        environment: "node",
        // The zero-Next gate walks every file under src/ synchronously; slow
        // (network-mounted) filesystems need more than the 5s default.
        testTimeout: 15000,
        include: [
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
            "tests/*.test.ts",
            "tests/parity/**/*.test.ts",
        ],
        exclude: ["node_modules", ".next"],
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: [
                "src/lib/api-client.ts",
                "src/lib/api-route-handler.ts",
                "src/lib/theme.ts",
                "src/store/**/*.ts",
                "src/services/**/*.ts",
                "src/app/api/**/route.ts",
            ],
        },
        setupFiles: ["./tests/setup.ts"],
    },
});
