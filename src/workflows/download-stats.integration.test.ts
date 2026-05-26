import { applyD1Migrations, introspectWorkflowInstance, reset, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { Result, type Result as ResultType } from "better-result";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import migration001 from "../../migrations/0001_initial.sql?raw";
import migration002 from "../../migrations/0002_package_versions.sql?raw";
import {
	readLatestRuns,
	readPackageVersions,
	readPackages,
	readSnapshots,
	readVersionDownloadSnapshots,
	type D1Error,
} from "@/lib/d1";

const clerkPackageId = "js-ts-clerk-nextjs";
const clerkPackageName = "@clerk/nextjs";
const encodedClerkPackageName = encodeURIComponent(clerkPackageName);

const migrations: D1Migration[] = [
	{ name: "0001_initial.sql", queries: splitSql(migration001) },
	{ name: "0002_package_versions.sql", queries: splitSql(migration002) },
];

describe("download stats workflow integration", () => {
	beforeEach(async () => {
		await reset();
		await applyD1Migrations(env.DB, migrations);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("persists package, download, version, and run data from mocked registry responses", async ({ expect }) => {
		const fetchMock = vi.fn<typeof mockSuccessfulNpmResponses>(mockSuccessfulNpmResponses);
		vi.stubGlobal("fetch", fetchMock);

		const instanceId = `test-success-${crypto.randomUUID()}`;
		await using instance = await introspectWorkflowInstance(env.DOWNLOAD_STATS_WORKFLOW, instanceId);

		await env.DOWNLOAD_STATS_WORKFLOW.create({
			id: instanceId,
			params: {
				trigger: "manual",
				requestedAt: "2026-05-25T12:00:00.000Z",
				packageIds: [clerkPackageId],
			},
		});

		await expect(instance.waitForStatus("complete")).resolves.not.toThrow();
		await expect(instance.getOutput()).resolves.toMatchObject({
			status: "completed",
			snapshots: 2,
			versions: 2,
			versionDownloads: 2,
			packagesUpdated: 1,
			errors: 0,
			versionErrors: 0,
		});

		const packages = unwrap(await readPackages(env.DB));
		expect(packages).toEqual([
			expect.objectContaining({
				id: clerkPackageId,
				name: clerkPackageName,
				registry: "npm",
			}),
		]);

		const snapshots = unwrap(await readSnapshots(env.DB));
		expect(snapshots).toEqual([
			expect.objectContaining({
				packageId: clerkPackageId,
				metric: "daily",
				date: "2026-05-23",
				downloads: 1000,
				source: "npm downloads API",
			}),
			expect.objectContaining({
				packageId: clerkPackageId,
				metric: "daily",
				date: "2026-05-24",
				downloads: 1200,
				source: "npm downloads API",
			}),
		]);

		const versions = unwrap(await readPackageVersions(env.DB, clerkPackageId));
		expect(versions).toEqual([
			expect.objectContaining({
				packageId: clerkPackageId,
				version: "2.1.0",
				publishedAt: "2026-05-20T00:00:00.000Z",
				distTag: "latest",
				source: "npm registry API",
			}),
			expect.objectContaining({
				packageId: clerkPackageId,
				version: "2.0.0",
				publishedAt: "2026-05-10T00:00:00.000Z",
				distTag: null,
				source: "npm registry API",
			}),
		]);

		const versionDownloads = unwrap(await readVersionDownloadSnapshots(env.DB, clerkPackageId));
		expect(versionDownloads).toEqual([
			expect.objectContaining({
				packageId: clerkPackageId,
				version: "2.1.0",
				metric: "weekly",
				downloads: 2100,
				source: "npm versions downloads API",
			}),
			expect.objectContaining({
				packageId: clerkPackageId,
				version: "2.0.0",
				metric: "weekly",
				downloads: 700,
				source: "npm versions downloads API",
			}),
		]);

		const runs = unwrap(await readLatestRuns(env.DB));
		expect(runs).toEqual([
			expect.objectContaining({
				id: instanceId,
				status: "completed",
				packagesTotal: 1,
				packagesUpdated: 1,
			}),
		]);
		expect(JSON.parse(runs[0].errorsJson ?? "{}")).toEqual({
			errors: [],
			versionErrors: [],
			unsupported: [],
			versionUnsupported: [],
		});

		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("records explicit ETL errors when mocked registry responses fail", async ({ expect }) => {
		vi.stubGlobal("fetch", vi.fn<typeof mockFailedDownloadResponse>(mockFailedDownloadResponse));

		const instanceId = `test-error-${crypto.randomUUID()}`;
		await using instance = await introspectWorkflowInstance(env.DOWNLOAD_STATS_WORKFLOW, instanceId);

		await env.DOWNLOAD_STATS_WORKFLOW.create({
			id: instanceId,
			params: {
				trigger: "manual",
				requestedAt: "2026-05-25T12:00:00.000Z",
				packageIds: [clerkPackageId],
			},
		});

		await expect(instance.waitForStatus("complete")).resolves.not.toThrow();
		await expect(instance.getOutput()).resolves.toMatchObject({
			status: "completed_with_errors",
			snapshots: 0,
			versionDownloads: 2,
			packagesUpdated: 0,
			errors: 1,
			versionErrors: 0,
		});

		const snapshots = unwrap(await readSnapshots(env.DB));
		expect(snapshots).toEqual([]);

		const runs = unwrap(await readLatestRuns(env.DB));
		expect(runs[0]).toEqual(
			expect.objectContaining({
				id: instanceId,
				status: "completed_with_errors",
				packagesTotal: 1,
				packagesUpdated: 0,
			}),
		);
		expect(JSON.parse(runs[0].errorsJson ?? "{}")).toMatchObject({
			errors: [
				expect.objectContaining({
					packageId: clerkPackageId,
					error: expect.stringContaining("503 Service Unavailable"),
				}),
			],
			versionErrors: [],
		});
	});
});

function mockSuccessfulNpmResponses(input: RequestInfo | URL) {
	const url = requestUrl(input);

	if (url === `https://api.npmjs.org/downloads/range/last-month/${encodedClerkPackageName}`) {
		return jsonResponse({
			downloads: [
				{ day: "2026-05-23", downloads: 1000 },
				{ day: "2026-05-24", downloads: 1200 },
			],
		});
	}

	if (url === `https://registry.npmjs.org/${encodedClerkPackageName}`) {
		return jsonResponse({
			time: {
				created: "2026-05-01T00:00:00.000Z",
				modified: "2026-05-21T00:00:00.000Z",
				"2.0.0": "2026-05-10T00:00:00.000Z",
				"2.1.0": "2026-05-20T00:00:00.000Z",
			},
			versions: {
				"2.0.0": {},
				"2.1.0": {},
			},
			"dist-tags": {
				latest: "2.1.0",
			},
		});
	}

	if (url === `https://api.npmjs.org/versions/${encodedClerkPackageName}/last-week`) {
		return jsonResponse({
			downloads: {
				"2.1.0": 2100,
				"2.0.0": 700,
			},
		});
	}

	throw new Error(`Unexpected external request: ${url}`);
}

function mockFailedDownloadResponse(input: RequestInfo | URL) {
	const url = requestUrl(input);

	if (url === `https://api.npmjs.org/downloads/range/last-month/${encodedClerkPackageName}`) {
		return jsonResponse({ error: "temporarily unavailable" }, 503, "Service Unavailable");
	}

	return mockSuccessfulNpmResponses(input);
}

function requestUrl(input: RequestInfo | URL) {
	if (input instanceof Request) {
		return input.url;
	}

	return input.toString();
}

function jsonResponse(body: unknown, status = 200, statusText?: string) {
	return new Response(JSON.stringify(body), {
		status,
		statusText,
		headers: {
			"content-type": "application/json",
		},
	});
}

function splitSql(sql: string) {
	return sql
		.split(";")
		.map((query) => query.trim())
		.filter(Boolean);
}

function unwrap<T>(result: ResultType<T, D1Error>) {
	if (Result.isError(result)) {
		throw result.error;
	}

	return result.value;
}
