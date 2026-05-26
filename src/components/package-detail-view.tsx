import { ArrowLeft, ChartLine, ExternalLink, type LucideIcon, PackageCheck, Tags, TrendingUp } from "lucide-react";
import Link from "next/link";
import { PackageDownloadTrendChart } from "@/components/package-download-trend-chart";
import { PackageVersionTrendChart } from "@/components/package-version-trend-chart";
import type { VersionDownloadSnapshotRow } from "@/lib/d1";
import type { PackageDetailData } from "@/lib/package-detail-data";
import { formatCompactNumber, formatInteger } from "@/lib/utils";

export function PackageDetailView({ data }: { data: PackageDetailData }) {
	const topVersionDownloads = latestVersionDownloadSnapshots(data.versionDownloads).slice(0, 12);
	const maxVersionDownloads = Math.max(1, ...topVersionDownloads.map((snapshot) => snapshot.downloads));
	const versionsByName = new Map(data.versions.map((version) => [version.version, version]));

	return (
		<main className="min-h-screen bg-background text-foreground">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
				<header className="flex flex-col gap-4 py-4">
					<Link
						href="/"
						className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
					>
						<ArrowLeft className="size-4" />
						Packages
					</Link>

					<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
						<div className="min-w-0">
							<div className="mb-3 flex flex-wrap items-center gap-2">
								<span className="rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
									{data.package.ecosystem}
								</span>
								<span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
									{data.package.registry}
								</span>
								<span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
									{data.package.category}
								</span>
							</div>
							<h1 className="break-words text-3xl font-semibold tracking-normal sm:text-4xl">{data.package.name}</h1>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
								{data.package.provider} package for {data.package.target}.
							</p>
						</div>
						<a
							href={data.package.sourceUrl}
							target="_blank"
							rel="noreferrer"
							className="inline-flex h-10 w-fit items-center gap-2 rounded-md border bg-card px-3 text-sm font-medium text-muted-foreground transition hover:text-foreground"
						>
							<ExternalLink className="size-4" />
							Registry
						</a>
					</div>
				</header>

				<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<MetricCard
						icon={ChartLine}
						label="Latest Downloads"
						value={data.stats.latestDownloads === null ? "No data" : formatCompactNumber(data.stats.latestDownloads)}
						detail={data.stats.latestMetric ? `${data.stats.latestMetric} metric` : "metric unavailable"}
					/>
					<MetricCard
						icon={Tags}
						label="Versions"
						value={formatInteger(data.stats.totalVersions)}
						detail={data.stats.latestVersion ? `latest ${data.stats.latestVersion}` : "no latest tag"}
					/>
					<MetricCard
						icon={TrendingUp}
						label="Version Downloads"
						value={formatCompactNumber(data.stats.weeklyVersionDownloads)}
						detail="last 7 days"
					/>
					<MetricCard
						icon={PackageCheck}
						label="Tracked Versions"
						value={formatInteger(data.stats.trackedVersions)}
						detail={data.sourceMessage}
					/>
				</section>

				<PackageDownloadTrendChart snapshots={data.snapshots} />

				<PackageVersionTrendChart snapshots={data.versionDownloads} />

				<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
					<section className="rounded-lg border bg-card shadow-sm">
						<div className="border-b px-4 py-4 sm:px-5">
							<h2 className="text-base font-semibold">Versions</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								Recent releases with weekly download activity where available.
							</p>
						</div>
						{data.versions.length > 0 ? (
							<div className="divide-y">
								{data.versions.slice(0, 28).map((version) => (
									<div
										key={version.version}
										className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_140px_120px] sm:items-center sm:px-5"
									>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<span className="break-all font-mono text-sm font-semibold text-card-foreground">
													{version.version}
												</span>
												{version.distTag ? (
													<span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
														{version.distTag}
													</span>
												) : null}
											</div>
											<p className="mt-1 text-xs text-muted-foreground">
												{version.publishedAt ? formatDate(version.publishedAt) : "Publish date unavailable"}
											</p>
										</div>
										<div className="text-sm font-medium sm:text-right">
											{version.weeklyDownloads === null ? "No data" : formatCompactNumber(version.weeklyDownloads)}
										</div>
										<p className="text-xs text-muted-foreground sm:text-right">last 7 days</p>
									</div>
								))}
							</div>
						) : (
							<EmptyState message="Version history is not available for this package yet." />
						)}
					</section>

					<section className="rounded-lg border bg-card shadow-sm">
						<div className="border-b px-4 py-4 sm:px-5">
							<h2 className="text-base font-semibold">Version Adoption</h2>
							<p className="mt-1 text-sm text-muted-foreground">Share of recent downloads by package version.</p>
						</div>
						{topVersionDownloads.length > 0 ? (
							<div className="grid gap-3 p-4 sm:p-5">
								{topVersionDownloads.map((snapshot) => {
									const version = versionsByName.get(snapshot.version);
									const width = `${Math.max(3, Math.round((snapshot.downloads / maxVersionDownloads) * 100))}%`;
									const share =
										data.stats.weeklyVersionDownloads > 0
											? Math.round((snapshot.downloads / data.stats.weeklyVersionDownloads) * 100)
											: 0;

									return (
										<div key={snapshot.version} className="grid gap-1.5">
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<div className="break-all font-mono text-xs font-semibold text-card-foreground">
														{snapshot.version}
													</div>
													<p className="mt-0.5 text-xs text-muted-foreground">
														{version?.distTag ? `${version.distTag} · ` : ""}
														{share}% of tracked downloads
													</p>
												</div>
												<div className="shrink-0 text-right text-sm font-semibold">
													{formatCompactNumber(snapshot.downloads)}
												</div>
											</div>
											<div className="h-2 rounded-full bg-muted">
												<div className="h-full rounded-full bg-[var(--chart-2)]" style={{ width }} />
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<EmptyState message="Version adoption data is not available for this package yet." />
						)}
					</section>
				</div>
			</div>
		</main>
	);
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
			<div className="mt-3 break-words text-2xl font-semibold">{value}</div>
			<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
		</div>
	);
}

function EmptyState({ message }: { message: string }) {
	return <div className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">{message}</div>;
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

function formatDate(value: string) {
	return new Date(value).toLocaleDateString("en", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}
