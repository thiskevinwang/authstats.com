import { AUTH_PACKAGES, SUPPORTED_DOWNLOAD_REGISTRIES, type AuthPackage } from "@/lib/package-catalog";
import { daysAgo, toIsoDate } from "@/lib/utils";

export type SnapshotMetric = "daily" | "weekly" | "monthly" | "recent" | "total";

export type DownloadSnapshotInput = {
	packageId: string;
	metric: SnapshotMetric;
	date: string;
	downloads: number;
	source: string;
	fetchedAt: string;
};

export type PackageFetchResult = {
	packageId: string;
	snapshots: DownloadSnapshotInput[];
	error?: string;
	unsupportedReason?: string;
};

const userAgent = "authstats.com download stats workflow";

export async function fetchAllPackageSnapshots(
	packages: readonly AuthPackage[] = AUTH_PACKAGES,
	fetchedAt = new Date(),
) {
	const results = await mapWithConcurrency(packages, 5, (pkg) => fetchPackageSnapshots(pkg, fetchedAt));
	return {
		results,
		snapshots: results.flatMap((result) => result.snapshots),
		errors: results.filter((result) => result.error),
		unsupported: results.filter((result) => result.unsupportedReason),
	};
}

export async function fetchPackageSnapshots(pkg: AuthPackage, fetchedAtDate = new Date()): Promise<PackageFetchResult> {
	const fetchedAt = fetchedAtDate.toISOString();
	const today = toIsoDate(fetchedAtDate);

	if (!SUPPORTED_DOWNLOAD_REGISTRIES.has(pkg.registry)) {
		return {
			packageId: pkg.id,
			snapshots: [],
			unsupportedReason: `${pkg.registry} does not expose a stable public downloads API suitable for this ETL.`,
		};
	}

	try {
		switch (pkg.registry) {
			case "npm":
				return { packageId: pkg.id, snapshots: await fetchNpmSnapshots(pkg, fetchedAt) };
			case "pypi":
				return { packageId: pkg.id, snapshots: await fetchPypiSnapshots(pkg, fetchedAt, today) };
			case "rubygems":
				return { packageId: pkg.id, snapshots: await fetchRubyGemsSnapshots(pkg, fetchedAt, today) };
			case "packagist":
				return { packageId: pkg.id, snapshots: await fetchPackagistSnapshots(pkg, fetchedAt, today) };
			case "nuget":
				return { packageId: pkg.id, snapshots: await fetchNugetSnapshots(pkg, fetchedAt, today) };
			case "crates":
				return { packageId: pkg.id, snapshots: await fetchCratesSnapshots(pkg, fetchedAt, today) };
			case "hex":
				return { packageId: pkg.id, snapshots: await fetchHexSnapshots(pkg, fetchedAt, today) };
			default:
				return { packageId: pkg.id, snapshots: [] };
		}
	} catch (error) {
		return {
			packageId: pkg.id,
			snapshots: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

async function fetchNpmSnapshots(pkg: AuthPackage, fetchedAt: string): Promise<DownloadSnapshotInput[]> {
	const url = `https://api.npmjs.org/downloads/range/last-month/${encodeURIComponent(pkg.name)}`;
	const data = await fetchJson<{ downloads?: { downloads: number; day: string }[] }>(url);
	return (data.downloads ?? []).map((row) => ({
		packageId: pkg.id,
		metric: "daily",
		date: row.day,
		downloads: safeCount(row.downloads),
		source: "npm downloads API",
		fetchedAt,
	}));
}

async function fetchPypiSnapshots(
	pkg: AuthPackage,
	fetchedAt: string,
	today: string,
): Promise<DownloadSnapshotInput[]> {
	const url = `https://pypistats.org/api/packages/${encodeURIComponent(pkg.name)}/overall?mirrors=false`;
	const data = await fetchJson<{ data?: { date: string; downloads: number; category: string }[] }>(url);
	const since = daysAgo(30);
	const rows = (data.data ?? []).filter((row) => row.category === "without_mirrors" && row.date >= since);

	if (rows.length === 0) {
		return [];
	}

	return rows.map((row) => ({
		packageId: pkg.id,
		metric: "daily",
		date: row.date || today,
		downloads: safeCount(row.downloads),
		source: "pypistats overall API",
		fetchedAt,
	}));
}

async function fetchRubyGemsSnapshots(
	pkg: AuthPackage,
	fetchedAt: string,
	today: string,
): Promise<DownloadSnapshotInput[]> {
	const data = await fetchJson<{ downloads?: number; version_downloads?: number }>(
		`https://rubygems.org/api/v1/gems/${encodeURIComponent(pkg.name)}.json`,
	);

	return [
		{
			packageId: pkg.id,
			metric: "total",
			date: today,
			downloads: safeCount(data.downloads),
			source: "RubyGems API",
			fetchedAt,
		},
		{
			packageId: pkg.id,
			metric: "recent",
			date: today,
			downloads: safeCount(data.version_downloads),
			source: "RubyGems API latest version downloads",
			fetchedAt,
		},
	];
}

async function fetchPackagistSnapshots(
	pkg: AuthPackage,
	fetchedAt: string,
	today: string,
): Promise<DownloadSnapshotInput[]> {
	const urlName = pkg.name.split("/").map(encodeURIComponent).join("/");
	const data = await fetchJson<{ package?: { downloads?: { total?: number; monthly?: number; daily?: number } } }>(
		`https://packagist.org/packages/${urlName}.json`,
	);
	const downloads = data.package?.downloads ?? {};

	return compactSnapshots([
		["daily", downloads.daily],
		["monthly", downloads.monthly],
		["total", downloads.total],
	]).map(([metric, downloads]) => ({
		packageId: pkg.id,
		metric,
		date: today,
		downloads,
		source: "Packagist API",
		fetchedAt,
	}));
}

async function fetchNugetSnapshots(
	pkg: AuthPackage,
	fetchedAt: string,
	today: string,
): Promise<DownloadSnapshotInput[]> {
	const data = await fetchJson<{ data?: { id: string; totalDownloads?: number }[] }>(
		`https://api-v2v3search-0.nuget.org/query?q=PackageId:${encodeURIComponent(pkg.name)}&prerelease=true`,
	);
	const exact = (data.data ?? []).find((item) => item.id.toLowerCase() === pkg.name.toLowerCase()) ?? data.data?.[0];

	return exact
		? [
				{
					packageId: pkg.id,
					metric: "total",
					date: today,
					downloads: safeCount(exact.totalDownloads),
					source: "NuGet Search API",
					fetchedAt,
				},
			]
		: [];
}

async function fetchCratesSnapshots(
	pkg: AuthPackage,
	fetchedAt: string,
	today: string,
): Promise<DownloadSnapshotInput[]> {
	const [crateData, downloadsData] = await Promise.all([
		fetchJson<{ crate?: { downloads?: number; recent_downloads?: number } }>(
			`https://crates.io/api/v1/crates/${encodeURIComponent(pkg.name)}`,
		),
		fetchJson<{ version_downloads?: { date: string; downloads: number }[] }>(
			`https://crates.io/api/v1/crates/${encodeURIComponent(pkg.name)}/downloads`,
		),
	]);

	const daily = new Map<string, number>();
	for (const row of downloadsData.version_downloads ?? []) {
		daily.set(row.date, (daily.get(row.date) ?? 0) + safeCount(row.downloads));
	}

	return [
		...Array.from(daily.entries()).map(([date, downloads]) => ({
			packageId: pkg.id,
			metric: "daily" as const,
			date,
			downloads,
			source: "crates.io downloads API",
			fetchedAt,
		})),
		{
			packageId: pkg.id,
			metric: "recent" as const,
			date: today,
			downloads: safeCount(crateData.crate?.recent_downloads),
			source: "crates.io crate API",
			fetchedAt,
		},
		{
			packageId: pkg.id,
			metric: "total" as const,
			date: today,
			downloads: safeCount(crateData.crate?.downloads),
			source: "crates.io crate API",
			fetchedAt,
		},
	];
}

async function fetchHexSnapshots(pkg: AuthPackage, fetchedAt: string, today: string): Promise<DownloadSnapshotInput[]> {
	const data = await fetchJson<{ downloads?: { all?: number; day?: number; recent?: number; week?: number } }>(
		`https://hex.pm/api/packages/${encodeURIComponent(pkg.name)}`,
	);
	const downloads = data.downloads ?? {};

	return compactSnapshots([
		["daily", downloads.day],
		["weekly", downloads.week],
		["recent", downloads.recent],
		["total", downloads.all],
	]).map(([metric, downloads]) => ({
		packageId: pkg.id,
		metric,
		date: today,
		downloads,
		source: "Hex API",
		fetchedAt,
	}));
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		headers: {
			accept: "application/json",
			"user-agent": userAgent,
		},
	});

	if (!response.ok) {
		throw new Error(`${response.status} ${response.statusText} from ${url}`);
	}

	return response.json<T>();
}

function safeCount(value: unknown) {
	const number = typeof value === "number" ? value : Number(value ?? 0);
	return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function compactSnapshots(rows: [SnapshotMetric, number | undefined][]) {
	return rows
		.map(([metric, downloads]) => [metric, safeCount(downloads)] as const)
		.filter(([, downloads]) => downloads > 0);
}

async function mapWithConcurrency<T, R>(items: readonly T[], concurrency: number, mapper: (item: T) => Promise<R>) {
	const results: R[] = [];
	let nextIndex = 0;

	async function worker() {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await mapper(items[index]);
		}
	}

	await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
	return results;
}
