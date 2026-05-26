"use client";

import { RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceArea, XAxis, YAxis } from "recharts";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import type { DashboardData } from "@/lib/dashboard-data";
import type { Registry } from "@/lib/package-catalog";
import { formatCompactNumber } from "@/lib/utils";

type TrendPoint = DashboardData["trend"][number];

type TrendSeries = {
	key: "npm" | "pypi" | "crates";
	registry: Registry;
	label: string;
	color: string;
};

type PackageNameTickProps = {
	x?: number;
	y?: number;
	payload?: {
		value?: string;
	};
};

type TrendZoomRange = {
	start: string;
	end: string;
};

type ChartPointerState = {
	activeLabel?: unknown;
};

const trendSeries: TrendSeries[] = [
	{ key: "npm", registry: "npm", label: "npm", color: "var(--chart-2)" },
	{ key: "pypi", registry: "pypi", label: "PyPI", color: "var(--chart-3)" },
	{ key: "crates", registry: "crates", label: "crates.io", color: "var(--chart-4)" },
];

const trendConfig = {
	total: { label: "All daily downloads", color: "var(--chart-1)" },
};

const topConfig = {
	downloads: { label: "Package activity", color: "var(--chart-5)" },
};

const ecosystemConfig = {
	downloads: { label: "Package activity", color: "var(--chart-2)" },
};

export function DashboardCharts({ data }: { data: DashboardData }) {
	const [trendZoom, setTrendZoom] = useState<TrendZoomRange | null>(null);
	const [trendDrag, setTrendDrag] = useState<TrendZoomRange | null>(null);
	const visibleRegistries = new Set(data.packages.map((pkg) => pkg.registry));
	const visibleTrendSeries = trendSeries.filter((series) => visibleRegistries.has(series.registry));
	const visibleTrendConfig = {
		...trendConfig,
		...Object.fromEntries(
			visibleTrendSeries.map((series) => [series.key, { label: series.label, color: series.color }]),
		),
	};
	const activeTrendZoom = useMemo(() => resolveTrendZoom(data.trend, trendZoom), [data.trend, trendZoom]);
	const visibleTrendData = useMemo(() => sliceTrendData(data.trend, activeTrendZoom), [data.trend, activeTrendZoom]);
	const activeDragRange = trendDrag ? normalizeDateRange(trendDrag) : null;

	function beginTrendZoom(state: ChartPointerState | undefined) {
		const date = activeDateFromChartState(state);
		if (!date || data.trend.length < 2) {
			return;
		}

		setTrendDrag({ start: date, end: date });
	}

	function updateTrendZoom(state: ChartPointerState | undefined) {
		const date = activeDateFromChartState(state);
		if (!date || !trendDrag) {
			return;
		}

		setTrendDrag({ start: trendDrag.start, end: date });
	}

	function commitTrendZoom() {
		if (!trendDrag) {
			return;
		}

		const nextRange = normalizeDateRange(trendDrag);
		const nextData = sliceTrendData(data.trend, nextRange);
		if (nextData.length > 1 && nextData.length < data.trend.length) {
			setTrendZoom(nextRange);
		}
		setTrendDrag(null);
	}

	function resetTrendZoom() {
		setTrendZoom(null);
		setTrendDrag(null);
	}

	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
			<section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
				<div className="mb-4 flex items-start justify-between gap-3">
					<div>
						<h2 className="text-base font-semibold text-card-foreground">Download Trend</h2>
						<p className="mt-1 text-sm text-muted-foreground">Daily downloads across matching packages.</p>
					</div>
					{activeTrendZoom ? (
						<button
							type="button"
							onClick={resetTrendZoom}
							aria-label="Reset zoom"
							title="Reset zoom"
							className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground transition hover:text-foreground"
						>
							<RotateCcw className="size-4" />
						</button>
					) : null}
				</div>
				<ChartContainer
					config={visibleTrendConfig}
					className="h-[280px] w-full select-none sm:h-[340px] [&_.recharts-surface]:cursor-crosshair"
				>
					<AreaChart
						data={visibleTrendData}
						margin={{ top: 12, right: 10, left: 0, bottom: 0 }}
						onMouseDown={beginTrendZoom}
						onMouseMove={updateTrendZoom}
						onMouseUp={commitTrendZoom}
						onMouseLeave={() => setTrendDrag(null)}
					>
						<defs>
							<linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.35} />
								<stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.03} />
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
						<YAxis tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} width={42} />
						<ChartTooltip
							content={<ChartTooltipContent formatter={(value) => formatCompactNumber(Number(value ?? 0))} />}
						/>
						<ChartLegend content={<ChartLegendContent />} />
						<Area
							type="monotone"
							dataKey="total"
							stroke="var(--color-total)"
							fill="url(#fillTotal)"
							strokeWidth={2}
							dot={false}
						/>
						{visibleTrendSeries.map((series) => (
							<Area
								key={series.key}
								type="monotone"
								dataKey={series.key}
								stroke={`var(--color-${series.key})`}
								fill="transparent"
								strokeWidth={1.75}
								dot={false}
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
					</AreaChart>
				</ChartContainer>
			</section>

			<section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
				<div className="mb-4">
					<h2 className="text-base font-semibold text-card-foreground">Top Packages</h2>
					<p className="mt-1 text-sm text-muted-foreground">Packages with the most recent recorded activity.</p>
				</div>
				<ChartContainer config={topConfig} className="h-[360px] w-full">
					<BarChart data={data.topPackages} layout="vertical" margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
						<CartesianGrid horizontal={false} />
						<XAxis type="number" tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} />
						<YAxis
							dataKey="name"
							type="category"
							tickLine={false}
							axisLine={false}
							width={172}
							tick={<PackageNameTick />}
							interval={0}
						/>
						<ChartTooltip
							content={<ChartTooltipContent formatter={(value) => formatCompactNumber(Number(value ?? 0))} />}
						/>
						<Bar dataKey="downloads" fill="var(--color-downloads)" radius={[0, 4, 4, 0]} />
					</BarChart>
				</ChartContainer>
			</section>

			<section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5 lg:col-span-2">
				<div className="mb-4">
					<h2 className="text-base font-semibold text-card-foreground">Ecosystem Coverage</h2>
					<p className="mt-1 text-sm text-muted-foreground">Registry coverage and recorded activity by ecosystem.</p>
				</div>
				<ChartContainer config={ecosystemConfig} className="h-[300px] w-full sm:h-[340px]">
					<BarChart data={data.ecosystems} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="ecosystem"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							interval={0}
							angle={-20}
							textAnchor="end"
							height={64}
						/>
						<YAxis tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} width={42} />
						<ChartTooltip
							content={<ChartTooltipContent formatter={(value) => formatCompactNumber(Number(value ?? 0))} />}
						/>
						<Bar dataKey="downloads" fill="var(--color-downloads)" radius={[4, 4, 0, 0]} />
					</BarChart>
				</ChartContainer>
			</section>
		</div>
	);
}

function activeDateFromChartState(state: ChartPointerState | undefined) {
	return typeof state?.activeLabel === "string" ? state.activeLabel : null;
}

function normalizeDateRange(range: TrendZoomRange) {
	return range.start <= range.end ? range : { start: range.end, end: range.start };
}

function resolveTrendZoom(data: TrendPoint[], range: TrendZoomRange | null) {
	if (!range) {
		return null;
	}

	const normalized = normalizeDateRange(range);
	const startIndex = data.findIndex((point) => point.date === normalized.start);
	const endIndex = data.findIndex((point) => point.date === normalized.end);
	return startIndex !== -1 && endIndex !== -1 && startIndex !== endIndex ? normalized : null;
}

function sliceTrendData(data: TrendPoint[], range: TrendZoomRange | null) {
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

function PackageNameTick({ x = 0, y = 0, payload }: PackageNameTickProps) {
	return (
		<g transform={`translate(${x},${y})`}>
			<foreignObject x={-168} y={-16} width={164} height={34}>
				<div className="flex h-full items-center justify-end break-all text-right text-[11px] leading-[12px] text-muted-foreground">
					{payload?.value}
				</div>
			</foreignObject>
		</g>
	);
}
