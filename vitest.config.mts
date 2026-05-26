import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(dirname, "src"),
		},
	},
	plugins: [
		cloudflareTest({
			wrangler: {
				configPath: "./wrangler.jsonc",
				environment: "test",
			},
		}),
	],
	test: {
		hookTimeout: 20_000,
		include: ["src/**/*.test.ts"],
		testTimeout: 20_000,
	},
});
