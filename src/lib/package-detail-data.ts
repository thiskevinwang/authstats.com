import { Result, TaggedError, type Result as ResultType } from "better-result";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import {
	readPackageVersions,
	readPackages,
	readSnapshots,
	readVersionDownloadSnapshots,
	type PackageVersionRow,
	type SnapshotRow,
	type VersionDownloadSnapshotRow,
} from "@/lib/d1";
import { AUTH_PACKAGES, type AuthPackage, type Registry } from "@/lib/package-catalog";

export type PackageDetailData = {
	package: AuthPackage;
	sourceMessage: string;
	snapshots: SnapshotRow[];
	versions: (PackageVersionRow & { weeklyDownloads: number | null })[];
	versionDownloads: VersionDownloadSnapshotRow[];
	stats: {
		latestDownloads: number | null;
		latestMetric: string | null;
		latestDate: string | null;
		totalVersions: number;
		trackedVersions: number;
		weeklyVersionDownloads: number;
		latestVersion: string | null;
	};
};

class PackageDetailError extends TaggedError("PackageDetailError")<{
	operation: string;
	message: string;
	cause: unknown;
}>() {}

const viewableRegistrySchema = z.string().transform((token, context) => {
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

export async function getPackageDetailData(packageId: string): Promise<PackageDetailData | null> {
	return readPackageDetailData((candidate) => candidate.id === packageId);
}

export async function getPackageDetailDataByRegistryPackage(
	registryValue: string,
	packageName: string,
): Promise<PackageDetailData | null> {
	const registry = registryAliases[registryValue.trim().toLowerCase()];
	if (!registry) {
		return null;
	}

	return readPackageDetailData((candidate) => candidate.registry === registry && candidate.name === packageName);
}

async function readPackageDetailData(
	matchesPackage: (candidate: AuthPackage) => boolean,
): Promise<PackageDetailData | null> {
	const contextResult = await Result.tryPromise({
		try: () => getCloudflareContext({ async: true }),
		catch: (cause) =>
			new PackageDetailError({
				operation: "read environment",
				message: errorMessage(cause),
				cause,
			}),
	});
	const context = Result.isOk(contextResult) ? contextResult.value : null;
	const env = context?.env as (CloudflareEnv & { VIEWABLE_REGISTRIES?: string }) | undefined;
	const viewableRegistries = parseViewableRegistries(env?.VIEWABLE_REGISTRIES).unwrapOr(undefined);
	const db = env?.DB;

	const packageRowsResult = db ? await readPackages(db) : Result.ok(AUTH_PACKAGES);
	const packages =
		Result.isOk(packageRowsResult) && packageRowsResult.value.length > 0 ? packageRowsResult.value : AUTH_PACKAGES;
	const pkg = packages.find(matchesPackage);

	if (!pkg || (viewableRegistries && !viewableRegistries.has(pkg.registry))) {
		return null;
	}

	const snapshotsResult = db ? await readSnapshots(db) : Result.ok<SnapshotRow[]>([]);
	const snapshots = Result.isOk(snapshotsResult)
		? snapshotsResult.value.filter((snapshot) => snapshot.packageId === pkg.id)
		: [];

	const [versions, versionDownloads, versionSourceMessage] = await readVersionActivity(db, pkg);
	const latestVersionDownloads = latestVersionDownloadSnapshots(versionDownloads);
	const weeklyDownloadsByVersion = new Map(
		latestVersionDownloads.map((snapshot) => [snapshot.version, snapshot.downloads]),
	);
	const versionsWithDownloads = versions.map((version) => ({
		...version,
		weeklyDownloads: weeklyDownloadsByVersion.get(version.version) ?? null,
	}));
	const latestSnapshot = latestPackageSnapshot(snapshots);

	return {
		package: pkg,
		sourceMessage: versionSourceMessage,
		snapshots,
		versions: versionsWithDownloads,
		versionDownloads,
		stats: {
			latestDownloads: latestSnapshot?.downloads ?? null,
			latestMetric: latestSnapshot?.metric ?? null,
			latestDate: latestSnapshot?.date ?? null,
			totalVersions: versions.length,
			trackedVersions: latestVersionDownloads.length,
			weeklyVersionDownloads: latestVersionDownloads.reduce((total, snapshot) => total + snapshot.downloads, 0),
			latestVersion:
				versions.find((version) => version.distTag?.split(", ").includes("latest"))?.version ??
				versions[0]?.version ??
				null,
		},
	};
}

async function readVersionActivity(
	db: D1Database | undefined,
	pkg: AuthPackage,
): Promise<[PackageVersionRow[], VersionDownloadSnapshotRow[], string]> {
	if (db) {
		const [versionsResult, downloadsResult] = await Promise.all([
			readPackageVersions(db, pkg.id),
			readVersionDownloadSnapshots(db, pkg.id),
		]);
		if (
			Result.isOk(versionsResult) &&
			Result.isOk(downloadsResult) &&
			(versionsResult.value.length > 0 || downloadsResult.value.length > 0)
		) {
			return [
				mergeVersionRows(versionsResult.value, downloadsResult.value),
				downloadsResult.value,
				"Showing latest collected version activity.",
			];
		}
	}

	return [
		[],
		[],
		pkg.registry === "npm"
			? "Version activity has not been collected yet."
			: "Version activity is not available for this registry yet.",
	];
}

function mergeVersionRows(versions: PackageVersionRow[], downloads: VersionDownloadSnapshotRow[]) {
	const byVersion = new Map(versions.map((version) => [version.version, version]));
	for (const download of downloads) {
		if (!byVersion.has(download.version)) {
			byVersion.set(download.version, {
				packageId: download.packageId,
				version: download.version,
				publishedAt: null,
				distTag: null,
				source: download.source,
				fetchedAt: download.fetchedAt,
			});
		}
	}

	return Array.from(byVersion.values()).sort((a, b) => {
		const publishedSort = (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
		return publishedSort || a.version.localeCompare(b.version);
	});
}

function latestPackageSnapshot(snapshots: SnapshotRow[]) {
	return snapshots
		.slice()
		.sort((a, b) =>
			`${b.date}:${snapshotPriority(b.metric)}`.localeCompare(`${a.date}:${snapshotPriority(a.metric)}`),
		)[0];
}

function latestVersionDownloadSnapshots(snapshots: VersionDownloadSnapshotRow[]) {
	const latestDate = snapshots.reduce<string | null>((latest, snapshot) => {
		if (!latest || snapshot.date > latest) {
			return snapshot.date;
		}
		return latest;
	}, null);

	return snapshots.filter((snapshot) => snapshot.date === latestDate).sort((a, b) => b.downloads - a.downloads);
}

function snapshotPriority(metric: string) {
	switch (metric) {
		case "daily":
			return 5;
		case "weekly":
			return 4;
		case "monthly":
			return 3;
		case "recent":
			return 2;
		default:
			return 1;
	}
}

function parseViewableRegistries(value: string | undefined): ResultType<Set<Registry> | undefined, PackageDetailError> {
	const parseResult = z
		.array(viewableRegistrySchema)
		.safeParse(value?.trim() ? value.split(/[\s,]+/).filter(Boolean) : []);
	if (!parseResult.success) {
		return Result.err(
			new PackageDetailError({
				operation: "parse viewable registries",
				message: errorMessage(parseResult.error),
				cause: parseResult.error,
			}),
		);
	}

	return Result.ok(parseResult.data.length > 0 ? new Set(parseResult.data) : undefined);
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

function errorMessage(cause: unknown) {
	if (cause instanceof z.ZodError) {
		return cause.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; ");
	}

	if (cause instanceof Error) {
		return cause.message;
	}

	return String(cause);
}
