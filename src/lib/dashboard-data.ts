import { Result, TaggedError, type Result as ResultType } from "better-result";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { AUTH_PACKAGES, SUPPORTED_DOWNLOAD_REGISTRIES, type AuthPackage, type Registry } from "@/lib/package-catalog";
import { readLatestRuns, readPackages, readSnapshots, type D1Error, type EtlRunRow, type SnapshotRow } from "@/lib/d1";

export type PackageSummary = AuthPackage & {
	latestDownloads: number | null;
	latestMetric: string | null;
	latestDate: string | null;
	comparableDailyDownloads: number | null;
};

export type DashboardData = {
	source: "d1" | "empty";
	sourceMessage: string;
	updatedAt: string | null;
	lastRun: EtlRunRow | null;
	snapshots: SnapshotRow[];
	packages: PackageSummary[];
	trend: { date: string; total: number; npm: number; pypi: number; crates: number }[];
	topPackages: { id: string; name: string; ecosystem: string; downloads: number; metric: string }[];
	ecosystems: { ecosystem: string; packages: number; supported: number; downloads: number }[];
	stats: {
		totalPackages: number;
		supportedPackages: number;
		snapshots: number;
		latestDailyDownloads: number;
	};
};

export async function getDashboardData(): Promise<DashboardData> {
	const contextResult = await Result.tryPromise({
		try: () => getCloudflareContext({ async: true }),
		catch: (cause) =>
			new DashboardDataError({
				operation: "read environment",
				message: errorMessage(cause),
				cause,
			}),
	});
	if (Result.isError(contextResult)) {
		return buildEmptyDashboard("Package activity is temporarily unavailable.");
	}

	const envResult = parseDashboardEnv(contextResult.value.env);
	if (Result.isError(envResult)) {
		return buildEmptyDashboard("Package activity is temporarily unavailable.", new Set());
	}
	const viewableRegistries = envResult.value.viewableRegistries;

	if (!envResult.value.db) {
		return buildEmptyDashboard("Package activity is not available in this environment yet.", viewableRegistries);
	}

	const [dbPackagesResult, snapshotsResult, runsResult] = await Promise.all([
		readPackages(envResult.value.db),
		readSnapshots(envResult.value.db),
		readLatestRuns(envResult.value.db),
	]);

	if (Result.isError(dbPackagesResult)) {
		return buildEmptyDashboard(friendlyDatabaseMessage(dbPackagesResult.error), viewableRegistries);
	}
	if (Result.isError(snapshotsResult)) {
		return buildEmptyDashboard(friendlyDatabaseMessage(snapshotsResult.error), viewableRegistries);
	}
	if (Result.isError(runsResult)) {
		return buildEmptyDashboard(friendlyDatabaseMessage(runsResult.error), viewableRegistries);
	}

	const packages = filterPackagesByRegistry(
		dbPackagesResult.value.length > 0 ? dbPackagesResult.value : AUTH_PACKAGES,
		viewableRegistries,
	);

	if (snapshotsResult.value.length === 0) {
		return buildDashboard(packages, [], runsResult.value, "d1", "Package activity has not been collected yet.");
	}

	return buildDashboard(
		packages,
		snapshotsResult.value,
		runsResult.value,
		"d1",
		"Showing the latest collected package activity.",
	);
}

function buildEmptyDashboard(reason: string, viewableRegistries?: Set<Registry>): DashboardData {
	const packages = filterPackagesByRegistry(AUTH_PACKAGES, viewableRegistries);
	return buildDashboard(packages, [], [], "empty", reason);
}

function buildDashboard(
	packages: AuthPackage[],
	snapshots: SnapshotRow[],
	runs: EtlRunRow[],
	source: DashboardData["source"],
	sourceMessage: string,
): DashboardData {
	const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));
	const viewablePackageIds = new Set(packageById.keys());
	const viewableSnapshots = snapshots.filter((snapshot) => viewablePackageIds.has(snapshot.packageId));
	const latestByPackage = new Map<string, SnapshotRow>();
	const dailyByDate = new Map<string, { date: string; total: number; npm: number; pypi: number; crates: number }>();

	for (const snapshot of viewableSnapshots) {
		const pkg = packageById.get(snapshot.packageId);
		if (!pkg) {
			continue;
		}

		const current = latestByPackage.get(snapshot.packageId);
		if (!current || snapshotPriority(snapshot) > snapshotPriority(current)) {
			latestByPackage.set(snapshot.packageId, snapshot);
		}

		if (snapshot.metric === "daily") {
			const row = dailyByDate.get(snapshot.date) ?? { date: snapshot.date, total: 0, npm: 0, pypi: 0, crates: 0 };
			row.total += snapshot.downloads;

			if (pkg.registry === "npm") {
				row.npm += snapshot.downloads;
			} else if (pkg.registry === "pypi") {
				row.pypi += snapshot.downloads;
			} else if (pkg.registry === "crates") {
				row.crates += snapshot.downloads;
			}

			dailyByDate.set(snapshot.date, row);
		}
	}

	const packageSummaries = packages.map((pkg) => {
		const latest = latestByPackage.get(pkg.id);
		return {
			...pkg,
			latestDownloads: latest?.downloads ?? null,
			latestMetric: latest?.metric ?? null,
			latestDate: latest?.date ?? null,
			comparableDailyDownloads: latest ? comparableDailyDownloads(latest) : null,
		};
	});

	const trend = Array.from(dailyByDate.values())
		.sort((a, b) => a.date.localeCompare(b.date))
		.slice(-45);

	const topPackages = packageSummaries
		.filter((pkg) => pkg.comparableDailyDownloads !== null)
		.sort((a, b) => (b.comparableDailyDownloads ?? 0) - (a.comparableDailyDownloads ?? 0))
		.slice(0, 10)
		.map((pkg) => ({
			id: pkg.id,
			name: pkg.name,
			ecosystem: pkg.ecosystem,
			downloads: pkg.comparableDailyDownloads ?? 0,
			metric: normalizedMetricLabel(pkg.latestMetric),
		}));

	const ecosystems = Array.from(groupBy(packages, (pkg) => pkg.ecosystem).entries())
		.map(([ecosystem, ecosystemPackages]) => ({
			ecosystem,
			packages: ecosystemPackages.length,
			supported: ecosystemPackages.filter((pkg) => SUPPORTED_DOWNLOAD_REGISTRIES.has(pkg.registry)).length,
			downloads: ecosystemPackages.reduce((total, pkg) => {
				const latest = latestByPackage.get(pkg.id);
				return total + (latest ? (comparableDailyDownloads(latest) ?? 0) : 0);
			}, 0),
		}))
		.sort((a, b) => b.downloads - a.downloads || b.packages - a.packages);

	const updatedAt =
		runs[0]?.completedAt ??
		viewableSnapshots.reduce<string | null>((latest, snapshot) => {
			if (!latest || snapshot.fetchedAt > latest) {
				return snapshot.fetchedAt;
			}
			return latest;
		}, null);

	return {
		source,
		sourceMessage,
		updatedAt,
		lastRun: runs[0] ?? null,
		snapshots: viewableSnapshots,
		packages: packageSummaries,
		trend,
		topPackages,
		ecosystems,
		stats: {
			totalPackages: packages.length,
			supportedPackages: packages.filter((pkg) => SUPPORTED_DOWNLOAD_REGISTRIES.has(pkg.registry)).length,
			snapshots: viewableSnapshots.length,
			latestDailyDownloads: trend.at(-1)?.total ?? 0,
		},
	};
}

class DashboardDataError extends TaggedError("DashboardDataError")<{
	operation: string;
	message: string;
	cause: unknown;
}>() {}

type DashboardEnv = {
	db?: D1Database;
	viewableRegistries?: Set<Registry>;
};

const dashboardEnvSchema = z
	.object({
		DB: z.custom<D1Database>((value) => value === undefined || value !== null).optional(),
		VIEWABLE_REGISTRIES: z.string().optional(),
	})
	.passthrough();

function parseDashboardEnv(env: unknown): ResultType<DashboardEnv, DashboardDataError> {
	const envResult = Result.try({
		try: () => dashboardEnvSchema.parse(env),
		catch: (cause) =>
			new DashboardDataError({
				operation: "parse environment",
				message: errorMessage(cause),
				cause,
			}),
	});
	if (Result.isError(envResult)) {
		return envResult;
	}

	const viewableRegistriesResult = parseViewableRegistries(envResult.value.VIEWABLE_REGISTRIES);
	if (Result.isError(viewableRegistriesResult)) {
		return viewableRegistriesResult;
	}

	return Result.ok({
		db: envResult.value.DB,
		viewableRegistries: viewableRegistriesResult.value,
	});
}

function parseViewableRegistries(value: string | undefined): ResultType<Set<Registry> | undefined, DashboardDataError> {
	return Result.try({
		try: () => {
			if (!value?.trim()) {
				return undefined;
			}

			const registries = z.array(registryTokenSchema).parse(value.split(/[\s,]+/).filter(Boolean));
			return registries.length > 0 ? new Set(registries) : undefined;
		},
		catch: (cause) =>
			new DashboardDataError({
				operation: "parse viewable registries",
				message: errorMessage(cause),
				cause,
			}),
	});
}

function filterPackagesByRegistry(packages: AuthPackage[], viewableRegistries: Set<Registry> | undefined) {
	if (!viewableRegistries) {
		return packages;
	}

	return packages.filter((pkg) => viewableRegistries.has(pkg.registry));
}

const registryAliases: Record<string, Registry> = {
	npm: "npm",
	pypi: "pypi",
	rubygems: "rubygems",
	"ruby-gems": "rubygems",
	packagist: "packagist",
	maven: "maven",
	nuget: "nuget",
	go: "go",
	crates: "crates",
	"crates.io": "crates",
	hex: "hex",
	pub: "pub",
	"pub.dev": "pub",
	swiftpackageindex: "swiftpackageindex",
	"swift-package-index": "swiftpackageindex",
};

const registryTokenSchema = z.string().transform((token, context) => {
	const registry = registryAliases[token.trim().toLowerCase()];
	if (!registry) {
		context.addIssue({
			code: "custom",
			message: `Unknown registry: ${token}`,
		});
		return z.NEVER;
	}

	return registry;
});

function friendlyDatabaseMessage(error: D1Error) {
	return error.message.includes("no such table")
		? "Package activity has not been collected yet."
		: "Package activity is temporarily unavailable.";
}

function errorMessage(cause: unknown) {
	if (cause instanceof z.ZodError) {
		return cause.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; ");
	}

	if (cause instanceof Error) {
		return cause.message;
	}

	return String(cause);
}

function snapshotPriority(snapshot: SnapshotRow) {
	const metricPriority: Record<string, number> = {
		daily: 5,
		weekly: 4,
		monthly: 3,
		recent: 2,
		total: 1,
	};

	return `${snapshot.date}:${metricPriority[snapshot.metric] ?? 0}`;
}

function comparableDailyDownloads(snapshot: SnapshotRow) {
	switch (snapshot.metric) {
		case "daily":
			return snapshot.downloads;
		case "weekly":
			return Math.round(snapshot.downloads / 7);
		case "monthly":
		case "recent":
			return Math.round(snapshot.downloads / 30);
		default:
			return null;
	}
}

function normalizedMetricLabel(metric: string | null) {
	switch (metric) {
		case "daily":
			return "daily";
		case "weekly":
			return "weekly";
		case "monthly":
			return "monthly";
		case "recent":
			return "recent";
		default:
			return "snapshot";
	}
}

function groupBy<T>(items: T[], key: (item: T) => string) {
	const groups = new Map<string, T[]>();
	for (const item of items) {
		const groupKey = key(item);
		groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
	}
	return groups;
}
