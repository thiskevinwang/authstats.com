"use client";

import { Activity, BarChart3, Database, Plus, type LucideIcon, PackageCheck, RotateCcw, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardCharts } from "@/components/dashboard-charts";
import { PackageComparisonChart } from "@/components/package-comparison-chart";
import type { DashboardData, PackageSummary } from "@/lib/dashboard-data";
import { SUPPORTED_DOWNLOAD_REGISTRIES, type Registry } from "@/lib/package-catalog";
import { packageHref } from "@/lib/package-routes";
import { cn, formatCompactNumber, formatInteger } from "@/lib/utils";

const maxComparisonPackages = 5;

const registryLabels: Record<Registry, string> = {
	npm: "npm",
	pypi: "PyPI",
	rubygems: "RubyGems",
	packagist: "Packagist",
	maven: "Maven",
	nuget: "NuGet",
	go: "Go",
	crates: "crates.io",
	hex: "Hex",
	pub: "pub.dev",
	swiftpackageindex: "Swift Package Index",
};

type PackageSearch = {
	error: string | null;
	hasQuery: boolean;
	matches: (name: string) => boolean;
};

export function DashboardExplorer({ data }: { data: DashboardData }) {
	const registries = useMemo(
		() =>
			Array.from(new Set(data.packages.map((pkg) => pkg.registry))).sort((a, b) =>
				registryLabels[a].localeCompare(registryLabels[b]),
			),
		[data.packages],
	);
	const [query, setQuery] = useState("");
	const [selectedRegistries, setSelectedRegistries] = useState<Set<Registry>>(() => new Set(registries));
	const [comparisonIds, setComparisonIds] = useState<Set<string>>(
		() => new Set(defaultComparisonPackageIds(data.packages)),
	);
	const packageSearch = useMemo(() => buildPackageSearch(query), [query]);
	const filteredData = useMemo(
		() => filterDashboardData(data, packageSearch, selectedRegistries),
		[data, packageSearch, selectedRegistries],
	);
	const packageById = useMemo(() => new Map(data.packages.map((pkg) => [pkg.id, pkg])), [data.packages]);
	const comparisonPackages = useMemo(
		() =>
			Array.from(comparisonIds)
				.map((packageId) => packageById.get(packageId))
				.filter((pkg): pkg is PackageSummary => Boolean(pkg)),
		[comparisonIds, packageById],
	);
	const comparisonCandidates = useMemo(() => {
		const selectedIds = new Set(comparisonPackages.map((pkg) => pkg.id));
		return [...filteredData.packages]
			.sort(
				(a, b) =>
					(b.comparableDailyDownloads ?? -1) - (a.comparableDailyDownloads ?? -1) || a.name.localeCompare(b.name),
			)
			.slice(0, 12)
			.sort((a, b) => Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id)) || a.name.localeCompare(b.name));
	}, [comparisonPackages, filteredData.packages]);

	const allSelected = selectedRegistries.size === registries.length;
	const comparisonLimitReached = comparisonPackages.length >= maxComparisonPackages;

	function toggleRegistry(registry: Registry) {
		setSelectedRegistries((current) => {
			const next = new Set(current);
			if (next.has(registry)) {
				next.delete(registry);
			} else {
				next.add(registry);
			}
			return next;
		});
	}

	function resetFilters() {
		setQuery("");
		setSelectedRegistries(new Set(registries));
	}

	function toggleComparisonPackage(packageId: string) {
		setComparisonIds((current) => {
			const next = new Set(current);
			if (next.has(packageId)) {
				next.delete(packageId);
				return next;
			}

			if (next.size >= maxComparisonPackages) {
				return current;
			}

			next.add(packageId);
			return next;
		});
	}

	function clearComparisonPackages() {
		setComparisonIds(new Set());
	}

	return (
		<div className="flex flex-col gap-5">
			<section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
				<div className="grid gap-4 lg:grid-cols-[minmax(240px,0.85fr)_minmax(0,1.15fr)] lg:items-start">
					<label className="block">
						<span className="mb-2 block text-sm font-medium text-card-foreground">Search Packages</span>
						<span className="relative block">
							<Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<input
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Search package names or regex"
								aria-label="Search package names or regex"
								aria-invalid={packageSearch.error ? true : undefined}
								className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-foreground/50 focus:ring-2 focus:ring-foreground/10"
								type="search"
							/>
						</span>
						{packageSearch.error ? (
							<span className="mt-2 block text-xs text-destructive">{packageSearch.error}</span>
						) : null}
					</label>

					<div>
						<div className="mb-2 flex items-center justify-between gap-3">
							<span className="text-sm font-medium text-card-foreground">Registries</span>
							<button
								type="button"
								onClick={resetFilters}
								className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
							>
								<RotateCcw className="size-3.5" />
								Reset
							</button>
						</div>
						<div className="flex flex-wrap gap-2">
							{registries.map((registry) => {
								const selected = selectedRegistries.has(registry);
								return (
									<label
										key={registry}
										className={cn(
											"inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-medium transition",
											selected
												? "border-foreground/20 bg-secondary text-secondary-foreground"
												: "border-border bg-background text-muted-foreground",
										)}
									>
										<input
											checked={selected}
											onChange={() => toggleRegistry(registry)}
											type="checkbox"
											aria-label={`Show ${registryLabels[registry]} packages`}
											className="size-3.5 accent-foreground"
										/>
										{registryLabels[registry]}
									</label>
								);
							})}
						</div>
						<p className="mt-2 text-xs text-muted-foreground">
							{formatInteger(filteredData.packages.length)} of {formatInteger(data.packages.length)} packages shown
							{allSelected && !packageSearch.hasQuery ? "" : " after filters"}.
						</p>
					</div>
				</div>
				<div className="mt-4 border-t pt-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h2 className="text-sm font-semibold text-card-foreground">Compare Packages</h2>
							<p className="mt-1 text-xs text-muted-foreground">
								{formatInteger(comparisonPackages.length)} of {formatInteger(maxComparisonPackages)} selected.
							</p>
						</div>
						{comparisonPackages.length > 0 ? (
							<button
								type="button"
								onClick={clearComparisonPackages}
								className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
							>
								<X className="size-3.5" />
								Clear
							</button>
						) : null}
					</div>

					{comparisonPackages.length > 0 ? (
						<div className="mt-3 flex gap-2 overflow-x-auto pb-1">
							{comparisonPackages.map((pkg) => (
								<button
									key={pkg.id}
									type="button"
									onClick={() => toggleComparisonPackage(pkg.id)}
									className="inline-flex max-w-full shrink-0 items-center gap-2 rounded-full border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground"
									title={`Remove ${pkg.name}`}
								>
									<span className="max-w-[15rem] truncate">{pkg.name}</span>
									<X className="size-3.5 shrink-0" />
								</button>
							))}
						</div>
					) : null}

					<div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
						{comparisonCandidates.map((pkg) => {
							const selected = comparisonIds.has(pkg.id);
							const disabled = !selected && comparisonLimitReached;

							return (
								<button
									key={pkg.id}
									type="button"
									onClick={() => toggleComparisonPackage(pkg.id)}
									aria-pressed={selected}
									disabled={disabled}
									className={cn(
										"flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs transition",
										selected
											? "border-secondary-foreground/30 bg-secondary text-secondary-foreground"
											: "border-border bg-background text-foreground hover:border-foreground/30",
										disabled && "cursor-not-allowed opacity-45 hover:border-border",
									)}
								>
									<span className="min-w-0">
										<span className="block truncate font-semibold">{pkg.name}</span>
										<span className="block truncate text-muted-foreground">{pkg.ecosystem}</span>
									</span>
									<Plus className={cn("size-4 shrink-0", selected && "rotate-45")} />
								</button>
							);
						})}
					</div>
				</div>
			</section>

			<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<MetricCard
					icon={PackageCheck}
					label="Packages"
					value={formatInteger(filteredData.stats.totalPackages)}
					detail="matching filters"
				/>
				<MetricCard
					icon={Database}
					label="Tracked"
					value={formatInteger(filteredData.stats.supportedPackages)}
					detail="registries with history"
				/>
				<MetricCard
					icon={Activity}
					label="Latest Daily"
					value={formatCompactNumber(filteredData.stats.latestDailyDownloads)}
					detail="matching packages"
				/>
				<MetricCard
					icon={BarChart3}
					label="Data Points"
					value={formatInteger(filteredData.stats.snapshots)}
					detail={
						filteredData.updatedAt ? new Date(filteredData.updatedAt).toLocaleDateString("en") : "not collected yet"
					}
				/>
			</section>

			<PackageComparisonChart packages={comparisonPackages} snapshots={data.snapshots} />

			<DashboardCharts data={filteredData} />

			<section id="packages" className="rounded-lg border bg-card shadow-sm">
				<div className="border-b px-4 py-4 sm:px-5">
					<h2 className="text-base font-semibold">Package Directory</h2>
					<p className="mt-1 text-sm text-muted-foreground">Latest recorded metric per package.</p>
				</div>
				{filteredData.packages.length > 0 ? (
					<div className="grid divide-y md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
						{filteredData.packages.map((pkg) => (
							<PackageRow
								key={pkg.id}
								pkg={pkg}
								comparisonDisabled={!comparisonIds.has(pkg.id) && comparisonLimitReached}
								comparisonSelected={comparisonIds.has(pkg.id)}
								onToggleComparison={toggleComparisonPackage}
							/>
						))}
					</div>
				) : (
					<div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">
						No packages match the current filters.
					</div>
				)}
			</section>
		</div>
	);
}

function defaultComparisonPackageIds(packages: PackageSummary[]) {
	return packages
		.filter((pkg) => pkg.comparableDailyDownloads !== null)
		.sort((a, b) => (b.comparableDailyDownloads ?? 0) - (a.comparableDailyDownloads ?? 0))
		.slice(0, Math.min(3, maxComparisonPackages))
		.map((pkg) => pkg.id);
}

function MetricCard({
	icon: Icon,
	label,
	value,
	detail,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	detail: string;
}) {
	return (
		<div className="rounded-lg border bg-card p-4 shadow-sm">
			<div className="flex items-center justify-between gap-3">
				<p className="text-sm font-medium text-muted-foreground">{label}</p>
				<Icon className="size-4 text-muted-foreground" />
			</div>
			<div className="mt-3 text-2xl font-semibold">{value}</div>
			<p className="mt-1 text-xs text-muted-foreground">{detail}</p>
		</div>
	);
}

function PackageRow({
	pkg,
	comparisonDisabled,
	comparisonSelected,
	onToggleComparison,
}: {
	pkg: PackageSummary;
	comparisonDisabled: boolean;
	comparisonSelected: boolean;
	onToggleComparison: (packageId: string) => void;
}) {
	return (
		<article className="flex min-h-32 flex-col justify-between gap-4 p-4 sm:p-5">
			<div>
				<div className="mb-2 flex flex-wrap items-center gap-2">
					<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
						{pkg.ecosystem}
					</span>
					<span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
						{registryLabels[pkg.registry]}
					</span>
				</div>
				<Link className="break-words text-sm font-semibold hover:underline" href={packageHref(pkg)}>
					{pkg.name}
				</Link>
				<p className="mt-1 text-xs leading-5 text-muted-foreground">
					{pkg.provider} · {pkg.category}
				</p>
			</div>
			<div className="flex items-end justify-between gap-3">
				<div>
					<div className="text-lg font-semibold">
						{pkg.latestDownloads === null ? "No data" : formatCompactNumber(pkg.latestDownloads)}
					</div>
					<p className="text-xs text-muted-foreground">
						{pkg.latestMetric ? `${pkg.latestMetric} metric` : "metric unavailable"}
					</p>
				</div>
				<div className="flex flex-col items-end gap-2">
					<label
						className={cn(
							"inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border bg-background px-2.5 text-xs font-medium transition",
							comparisonSelected
								? "border-secondary-foreground/30 text-secondary-foreground"
								: "text-muted-foreground hover:text-foreground",
							comparisonDisabled && "cursor-not-allowed opacity-45 hover:text-muted-foreground",
						)}
					>
						<input
							checked={comparisonSelected}
							disabled={comparisonDisabled}
							onChange={() => onToggleComparison(pkg.id)}
							type="checkbox"
							aria-label={`Compare ${pkg.name}`}
							className="size-3.5 accent-foreground"
						/>
						Compare
					</label>
					<p className="text-right text-xs text-muted-foreground">{pkg.latestDate ?? pkg.target}</p>
				</div>
			</div>
		</article>
	);
}

function filterDashboardData(
	data: DashboardData,
	search: PackageSearch,
	selectedRegistries: Set<Registry>,
): DashboardData {
	const packages = data.packages.filter((pkg) => {
		const matchesRegistry = selectedRegistries.has(pkg.registry);
		const matchesQuery = search.matches(pkg.name);

		return matchesRegistry && matchesQuery;
	});
	const packageIds = new Set(packages.map((pkg) => pkg.id));
	const snapshots = data.snapshots.filter((snapshot) => packageIds.has(snapshot.packageId));
	const trend = buildTrend(packages, snapshots);

	return {
		...data,
		snapshots,
		packages,
		trend,
		topPackages: buildTopPackages(packages),
		ecosystems: buildEcosystems(packages),
		stats: {
			totalPackages: packages.length,
			supportedPackages: packages.filter((pkg) => SUPPORTED_DOWNLOAD_REGISTRIES.has(pkg.registry)).length,
			snapshots: snapshots.length,
			latestDailyDownloads: trend.at(-1)?.total ?? 0,
		},
	};
}

function buildPackageSearch(query: string): PackageSearch {
	const trimmedQuery = query.trim();
	if (trimmedQuery.length === 0) {
		return {
			error: null,
			hasQuery: false,
			matches: () => true,
		};
	}

	if (trimmedQuery.length > 160) {
		return {
			error: "Search pattern is too long.",
			hasQuery: true,
			matches: () => false,
		};
	}

	const parsed = parseRegexQuery(trimmedQuery);
	try {
		const regex = new RegExp(parsed.pattern, parsed.flags);
		return {
			error: null,
			hasQuery: true,
			matches: (name) => {
				regex.lastIndex = 0;
				return regex.test(name);
			},
		};
	} catch {
		return {
			error: "Invalid search pattern.",
			hasQuery: true,
			matches: () => false,
		};
	}
}

function parseRegexQuery(query: string) {
	const slashRegex = query.match(/^\/((?:\\.|[^/])+)\/([imsuv]*)$/);
	if (!slashRegex) {
		return { pattern: query, flags: "i" };
	}

	return {
		pattern: slashRegex[1],
		flags: slashRegex[2],
	};
}

function buildTrend(packages: PackageSummary[], snapshots: DashboardData["snapshots"]) {
	const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));
	const dailyByDate = new Map<string, { date: string; total: number; npm: number; pypi: number; crates: number }>();

	for (const snapshot of snapshots) {
		const pkg = packageById.get(snapshot.packageId);
		if (!pkg || snapshot.metric !== "daily") {
			continue;
		}

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

	return Array.from(dailyByDate.values())
		.sort((a, b) => a.date.localeCompare(b.date))
		.slice(-45);
}

function buildTopPackages(packages: PackageSummary[]) {
	return packages
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
}

function buildEcosystems(packages: PackageSummary[]) {
	const grouped = new Map<string, PackageSummary[]>();
	for (const pkg of packages) {
		grouped.set(pkg.ecosystem, [...(grouped.get(pkg.ecosystem) ?? []), pkg]);
	}

	return Array.from(grouped.entries())
		.map(([ecosystem, ecosystemPackages]) => ({
			ecosystem,
			packages: ecosystemPackages.length,
			supported: ecosystemPackages.filter((pkg) => SUPPORTED_DOWNLOAD_REGISTRIES.has(pkg.registry)).length,
			downloads: ecosystemPackages.reduce((total, pkg) => total + (pkg.comparableDailyDownloads ?? 0), 0),
		}))
		.sort((a, b) => b.downloads - a.downloads || b.packages - a.packages);
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
