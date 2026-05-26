import { z } from "zod";
import { type AuthPackage } from "@/lib/package-catalog";
import { toIsoDate } from "@/lib/utils";

export type PackageVersionInput = {
	packageId: string;
	version: string;
	publishedAt: string | null;
	distTag: string | null;
	source: string;
	fetchedAt: string;
};

export type VersionDownloadSnapshotInput = {
	packageId: string;
	version: string;
	metric: "weekly";
	date: string;
	downloads: number;
	source: string;
	fetchedAt: string;
};

export type PackageVersionFetchResult = {
	packageId: string;
	versions: PackageVersionInput[];
	downloadSnapshots: VersionDownloadSnapshotInput[];
	error?: string;
	unsupportedReason?: string;
};

const maxVersionRows = 200;
const maxAdoptionRows = 80;
const userAgent = "authstats.com version stats workflow";

const npmMetadataSchema = z.object({
	time: z.record(z.string(), z.string()).optional(),
	versions: z.record(z.string(), z.unknown()).optional(),
	"dist-tags": z.record(z.string(), z.string()).optional(),
});

const npmVersionDownloadsSchema = z.object({
	downloads: z.record(z.string(), z.number()).optional(),
});

export async function fetchAllPackageVersionStats(packages: AuthPackage[], fetchedAt = new Date()) {
	const results = await mapWithConcurrency(packages, 4, (pkg) => fetchPackageVersionStats(pkg, fetchedAt));
	return {
		results,
		versions: results.flatMap((result) => result.versions),
		downloadSnapshots: results.flatMap((result) => result.downloadSnapshots),
		errors: results.filter((result) => result.error),
		unsupported: results.filter((result) => result.unsupportedReason),
	};
}

export async function fetchPackageVersionStats(
	pkg: AuthPackage,
	fetchedAtDate = new Date(),
): Promise<PackageVersionFetchResult> {
	if (pkg.registry !== "npm") {
		return {
			packageId: pkg.id,
			versions: [],
			downloadSnapshots: [],
			unsupportedReason: `${pkg.registry} version activity is not collected yet.`,
		};
	}

	try {
		return await fetchNpmVersionStats(pkg, fetchedAtDate);
	} catch (error) {
		return {
			packageId: pkg.id,
			versions: [],
			downloadSnapshots: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function fetchNpmVersionStats(pkg: AuthPackage, fetchedAtDate: Date): Promise<PackageVersionFetchResult> {
	const fetchedAt = fetchedAtDate.toISOString();
	const date = toIsoDate(fetchedAtDate);
	const encodedName = encodeURIComponent(pkg.name);
	const [metadata, downloadData] = await Promise.all([
		fetchJson(`https://registry.npmjs.org/${encodedName}`, npmMetadataSchema),
		fetchJson(`https://api.npmjs.org/versions/${encodedName}/last-week`, npmVersionDownloadsSchema),
	]);

	const publishedAtByVersion = new Map<string, string>();
	for (const [key, value] of Object.entries(metadata.time ?? {})) {
		if (key !== "created" && key !== "modified") {
			publishedAtByVersion.set(key, value);
		}
	}

	for (const version of Object.keys(metadata.versions ?? {})) {
		if (!publishedAtByVersion.has(version)) {
			publishedAtByVersion.set(version, "");
		}
	}

	const tagsByVersion = new Map<string, string[]>();
	for (const [tag, version] of Object.entries(metadata["dist-tags"] ?? {})) {
		tagsByVersion.set(version, [...(tagsByVersion.get(version) ?? []), tag]);
	}

	const downloadRows = Object.entries(downloadData.downloads ?? {})
		.map(([version, downloads]) => ({ version, downloads: safeCount(downloads) }))
		.filter((row) => row.downloads > 0)
		.sort((a, b) => b.downloads - a.downloads)
		.slice(0, maxAdoptionRows);

	const recentVersions = Array.from(publishedAtByVersion.entries())
		.map(([version, publishedAt]) => ({ version, publishedAt: publishedAt || null }))
		.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
		.slice(0, maxVersionRows);

	const versionNames = new Set([
		...recentVersions.map((row) => row.version),
		...downloadRows.map((row) => row.version),
	]);
	const versions = Array.from(versionNames)
		.map((version) => ({
			packageId: pkg.id,
			version,
			publishedAt: publishedAtByVersion.get(version) || null,
			distTag: tagsByVersion.get(version)?.join(", ") ?? null,
			source: "npm registry API",
			fetchedAt,
		}))
		.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

	return {
		packageId: pkg.id,
		versions,
		downloadSnapshots: downloadRows.map((row) => ({
			packageId: pkg.id,
			version: row.version,
			metric: "weekly" as const,
			date,
			downloads: row.downloads,
			source: "npm versions downloads API",
			fetchedAt,
		})),
	};
}

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": userAgent,
		},
	});

	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText} from ${url}`);
	}

	return schema.parse(await response.json());
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
	const results: R[] = [];
	let index = 0;

	async function worker() {
		while (index < items.length) {
			const current = items[index++];
			results.push(await mapper(current));
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return results;
}

function safeCount(value: unknown) {
	const number = typeof value === "number" ? value : Number(value ?? 0);
	return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}
