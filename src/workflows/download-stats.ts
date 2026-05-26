import { Result } from "better-result";
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { fetchAllPackageSnapshots } from "@/lib/download-fetchers";
import { fetchAllPackageVersionStats } from "@/lib/version-fetchers";
import { AUTH_PACKAGES } from "@/lib/package-catalog";
import {
	insertSnapshots,
	insertVersionDownloadSnapshots,
	recordEtlRun,
	upsertPackageCatalog,
	upsertPackageVersions,
	type D1Error,
} from "@/lib/d1";

export type DownloadStatsWorkflowParams = {
	trigger: "cron" | "manual";
	cron?: string;
	packageIds?: string[];
	scheduledTime?: number;
	requestedAt?: string;
};

export class DownloadStatsWorkflow extends WorkflowEntrypoint<CloudflareEnv, DownloadStatsWorkflowParams> {
	async run(event: WorkflowEvent<DownloadStatsWorkflowParams>, step: WorkflowStep) {
		const startedAt = new Date().toISOString();
		const runId = event.instanceId;
		const packages = selectPackages(event.payload.packageIds);

		await step.do("upsert package catalog", async () => {
			const result = await upsertPackageCatalog(this.env.DB, packages);
			if (Result.isError(result)) {
				throw new Error(formatD1Error(result.error));
			}
			return { packages: packages.length };
		});

		const fetchResult = await step.do(
			"fetch registry download snapshots",
			{ retries: { limit: 2, delay: "30 seconds", backoff: "linear" } },
			async () => fetchAllPackageSnapshots(packages, new Date()),
		);

		await step.do("persist download snapshots", async () => {
			const result = await insertSnapshots(this.env.DB, fetchResult.snapshots);
			if (Result.isError(result)) {
				throw new Error(formatD1Error(result.error));
			}
			return { snapshots: fetchResult.snapshots.length };
		});

		const versionResult = await step.do(
			"fetch package version activity",
			{ retries: { limit: 2, delay: "30 seconds", backoff: "linear" } },
			async () => fetchAllPackageVersionStats(packages, new Date()),
		);

		await step.do("persist package version activity", async () => {
			const versionsResult = await upsertPackageVersions(this.env.DB, versionResult.versions);
			if (Result.isError(versionsResult)) {
				throw new Error(formatD1Error(versionsResult.error));
			}

			const downloadsResult = await insertVersionDownloadSnapshots(this.env.DB, versionResult.downloadSnapshots);
			if (Result.isError(downloadsResult)) {
				throw new Error(formatD1Error(downloadsResult.error));
			}

			return {
				versions: versionResult.versions.length,
				versionDownloads: versionResult.downloadSnapshots.length,
			};
		});

		const completedAt = new Date().toISOString();
		const packagesUpdated = new Set(fetchResult.snapshots.map((snapshot) => snapshot.packageId)).size;
		const versionErrors = versionResult.errors.length;
		const status = fetchResult.errors.length > 0 || versionErrors > 0 ? "completed_with_errors" : "completed";

		await step.do("record etl run", async () => {
			const result = await recordEtlRun(this.env.DB, {
				id: runId,
				startedAt,
				completedAt,
				status,
				packagesTotal: packages.length,
				packagesUpdated,
				errorsJson: JSON.stringify({
					errors: fetchResult.errors,
					versionErrors: versionResult.errors,
					unsupported: fetchResult.unsupported,
					versionUnsupported: versionResult.unsupported,
				}),
			});
			if (Result.isError(result)) {
				throw new Error(formatD1Error(result.error));
			}
			return {
				status,
				packagesUpdated,
				errors: fetchResult.errors.length,
				unsupported: fetchResult.unsupported.length,
			};
		});

		return {
			trigger: event.payload.trigger,
			status,
			snapshots: fetchResult.snapshots.length,
			versions: versionResult.versions.length,
			versionDownloads: versionResult.downloadSnapshots.length,
			packagesUpdated,
			errors: fetchResult.errors.length,
			versionErrors,
			unsupported: fetchResult.unsupported.length,
			completedAt,
		};
	}
}

function formatD1Error(error: D1Error) {
	return `${error.operation}: ${error.message}`;
}

function selectPackages(packageIds: string[] | undefined) {
	if (!packageIds?.length) {
		return AUTH_PACKAGES;
	}

	const allowedIds = new Set(packageIds);
	return AUTH_PACKAGES.filter((pkg) => allowedIds.has(pkg.id));
}
