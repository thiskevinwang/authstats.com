"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { VersionDownloadSnapshotRow } from "@/lib/d1";
import { formatCompactNumber } from "@/lib/utils";

type VersionTrendDatum = {
	date: string;
} & Record<string, number | string | null>;

const versionPalette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function PackageVersionTrendChart({ snapshots }: { snapshots: VersionDownloadSnapshotRow[] }) {
	const { chartData, chartConfig, series } = useMemo(() => buildVersionTrend(snapshots), [snapshots]);

	return (
		<section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
			<div className="mb-4">
				<h2 className="text-base font-semibold text-card-foreground">Version Trend</h2>
				<p className="mt-1 text-sm text-muted-foreground">Weekly downloads by version over time.</p>
			</div>
			{chartData.length > 0 && series.length > 0 ? (
				<ChartContainer config={chartConfig} className="h-[300px] w-full sm:h-[360px]">
					<LineChart data={chartData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
						<YAxis tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} width={42} />
						<ChartTooltip
							content={<ChartTooltipContent formatter={(value) => formatCompactNumber(Number(value ?? 0))} />}
						/>
						{series.map((version) => (
							<Line
								key={version.key}
								type="monotone"
								dataKey={version.key}
								stroke={`var(--color-${version.key})`}
								strokeWidth={1.6}
								dot={{ r: 2 }}
								activeDot={{ r: 4 }}
								connectNulls
							/>
						))}
					</LineChart>
				</ChartContainer>
			) : (
				<div className="flex h-[300px] items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground sm:h-[360px]">
					Version trend data is not available for this package yet.
				</div>
			)}
		</section>
	);
}

function buildVersionTrend(snapshots: VersionDownloadSnapshotRow[]) {
	const sortedSnapshots = snapshots.slice().sort((a, b) => a.date.localeCompare(b.date) || b.downloads - a.downloads);
	const statsByVersion = new Map<string, { latestDate: string; latestDownloads: number; totalDownloads: number }>();

	for (const snapshot of sortedSnapshots) {
		const current = statsByVersion.get(snapshot.version);
		const isLatest = !current || snapshot.date >= current.latestDate;

		statsByVersion.set(snapshot.version, {
			latestDate: isLatest ? snapshot.date : current.latestDate,
			latestDownloads: isLatest ? snapshot.downloads : current.latestDownloads,
			totalDownloads: (current?.totalDownloads ?? 0) + snapshot.downloads,
		});
	}

	const sortedVersions = Array.from(statsByVersion.entries()).sort(
		([versionA, statsA], [versionB, statsB]) =>
			statsB.latestDownloads - statsA.latestDownloads ||
			statsB.totalDownloads - statsA.totalDownloads ||
			versionA.localeCompare(versionB),
	);
	const series = sortedVersions.map(([version, stats], index) => ({
		key: `version${index}`,
		version,
		color: versionColor(index),
		latestDownloads: stats.latestDownloads,
		totalDownloads: stats.totalDownloads,
	}));

	const keyByVersion = new Map(series.map((version) => [version.version, version.key]));
	const rowsByDate = new Map<string, VersionTrendDatum>();

	for (const snapshot of sortedSnapshots) {
		const key = keyByVersion.get(snapshot.version);
		if (!key) {
			continue;
		}

		const row = rowsByDate.get(snapshot.date) ?? { date: snapshot.date };
		row[key] = snapshot.downloads;
		rowsByDate.set(snapshot.date, row);
	}

	const chartConfig = Object.fromEntries(
		series.map((version) => [version.key, { label: version.version, color: version.color }]),
	) as ChartConfig;

	return {
		chartData: Array.from(rowsByDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
		chartConfig,
		series,
	};
}

function versionColor(index: number) {
	return versionPalette[index] ?? `hsl(${(index * 47) % 360} 68% 42%)`;
}
