"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, XAxis, YAxis } from "recharts";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import type { PackageSummary } from "@/lib/dashboard-data";
import type { SnapshotRow } from "@/lib/d1";
import { formatCompactNumber } from "@/lib/utils";

type ComparisonPoint = {
	date: string;
	[key: string]: number | string;
};

type TrendZoomRange = {
	start: string;
	end: string;
};

type ChartPointerState = {
	activeLabel?: unknown;
};

const comparisonColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function PackageComparisonChart({
	packages,
	snapshots,
}: {
	packages: PackageSummary[];
	snapshots: SnapshotRow[];
}) {
	const [zoom, setZoom] = useState<TrendZoomRange | null>(null);
	const [dragRange, setDragRange] = useState<TrendZoomRange | null>(null);
	const chartConfig = useMemo(() => buildChartConfig(packages), [packages]);
	const chartData = useMemo(() => buildComparisonData(packages, snapshots), [packages, snapshots]);
	const activeZoom = useMemo(() => resolveTrendZoom(chartData, zoom), [chartData, zoom]);
	const visibleData = useMemo(() => sliceTrendData(chartData, activeZoom), [chartData, activeZoom]);
	const activeDragRange = dragRange ? normalizeDateRange(dragRange) : null;

	function beginZoom(state: ChartPointerState | undefined) {
		const date = activeDateFromChartState(state);
		if (!date || chartData.length < 2) {
			return;
		}

		setDragRange({ start: date, end: date });
	}

	function updateZoom(state: ChartPointerState | undefined) {
		const date = activeDateFromChartState(state);
		if (!date || !dragRange) {
			return;
		}

		setDragRange({ start: dragRange.start, end: date });
	}

	function commitZoom() {
		if (!dragRange) {
			return;
		}

		const nextRange = normalizeDateRange(dragRange);
		const nextData = sliceTrendData(chartData, nextRange);
		if (nextData.length > 1 && nextData.length < chartData.length) {
			setZoom(nextRange);
		}
		setDragRange(null);
	}

	function resetZoom() {
		setZoom(null);
		setDragRange(null);
	}

	return (
		<section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
			<div className="mb-4 flex items-start justify-between gap-3">
				<div>
					<h2 className="text-base font-semibold text-card-foreground">Package Comparison</h2>
					<p className="mt-1 text-sm text-muted-foreground">Daily download trends for selected packages.</p>
				</div>
				{activeZoom ? (
					<button
						type="button"
						onClick={resetZoom}
						aria-label="Reset zoom"
						title="Reset zoom"
						className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:text-foreground"
					>
						<RotateCcw className="size-4" />
					</button>
				) : null}
			</div>

			{packages.length === 0 ? (
				<div className="flex min-h-56 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">
					Select packages to compare their trends.
				</div>
			) : chartData.length === 0 ? (
				<div className="flex min-h-56 items-center justify-center rounded-md border border-dashed px-4 text-center text-sm text-muted-foreground">
					Trend data is not available for the selected packages yet.
				</div>
			) : (
				<ChartContainer
					config={chartConfig}
					className="h-[300px] w-full select-none sm:h-[360px] [&_.recharts-surface]:cursor-crosshair"
				>
					<LineChart
						data={visibleData}
						margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
						onMouseDown={beginZoom}
						onMouseMove={updateZoom}
						onMouseUp={commitZoom}
						onMouseLeave={() => setDragRange(null)}
					>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
						<YAxis tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} width={42} />
						<ChartTooltip
							content={<ChartTooltipContent formatter={(value) => formatCompactNumber(Number(value ?? 0))} />}
						/>
						<ChartLegend content={<ChartLegendContent />} />
						{packages.map((pkg) => (
							<Line
								key={pkg.id}
								type="monotone"
								dataKey={pkg.id}
								stroke={`var(--color-${pkg.id})`}
								strokeWidth={2}
								dot={visibleData.length <= 1}
								connectNulls
								isAnimationActive={false}
							/>
						))}
						{activeDragRange ? (
							<ReferenceArea
								x1={activeDragRange.start}
								x2={activeDragRange.end}
								stroke="var(--foreground)"
								strokeOpacity={0.25}
								fill="var(--foreground)"
								fillOpacity={0.08}
							/>
						) : null}
					</LineChart>
				</ChartContainer>
			)}
		</section>
	);
}

function buildChartConfig(packages: PackageSummary[]) {
	return Object.fromEntries(
		packages.map((pkg, index) => [
			pkg.id,
			{
				label: pkg.name,
				color: comparisonColors[index % comparisonColors.length],
			},
		]),
	) as ChartConfig;
}

function buildComparisonData(packages: PackageSummary[], snapshots: SnapshotRow[]) {
	const selectedPackageIds = new Set(packages.map((pkg) => pkg.id));
	const dailyByDate = new Map<string, ComparisonPoint>();

	for (const snapshot of snapshots) {
		if (snapshot.metric !== "daily" || !selectedPackageIds.has(snapshot.packageId)) {
			continue;
		}

		const row = dailyByDate.get(snapshot.date) ?? { date: snapshot.date };
		row[snapshot.packageId] = snapshot.downloads;
		dailyByDate.set(snapshot.date, row);
	}

	return Array.from(dailyByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function activeDateFromChartState(state: ChartPointerState | undefined) {
	return typeof state?.activeLabel === "string" ? state.activeLabel : null;
}

function normalizeDateRange(range: TrendZoomRange) {
	return range.start <= range.end ? range : { start: range.end, end: range.start };
}

function resolveTrendZoom(data: ComparisonPoint[], range: TrendZoomRange | null) {
	if (!range) {
		return null;
	}

	const normalized = normalizeDateRange(range);
	const startIndex = data.findIndex((point) => point.date === normalized.start);
	const endIndex = data.findIndex((point) => point.date === normalized.end);
	return startIndex !== -1 && endIndex !== -1 && startIndex !== endIndex ? normalized : null;
}

function sliceTrendData(data: ComparisonPoint[], range: TrendZoomRange | null) {
	if (!range) {
		return data;
	}

	const startIndex = data.findIndex((point) => point.date === range.start);
	const endIndex = data.findIndex((point) => point.date === range.end);
	if (startIndex === -1 || endIndex === -1) {
		return data;
	}

	return data.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
}
