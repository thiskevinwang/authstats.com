"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { SnapshotRow } from "@/lib/d1";
import { formatCompactNumber } from "@/lib/utils";

const chartConfig = {
	downloads: { label: "Downloads", color: "var(--chart-1)" },
};

export function PackageDownloadTrendChart({ snapshots }: { snapshots: SnapshotRow[] }) {
	const chartData = useMemo(
		() =>
			snapshots
				.filter((snapshot) => snapshot.metric === "daily")
				.map((snapshot) => ({
					date: snapshot.date,
					downloads: snapshot.downloads,
				}))
				.sort((a, b) => a.date.localeCompare(b.date)),
		[snapshots],
	);

	return (
		<section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
			<div className="mb-4">
				<h2 className="text-base font-semibold text-card-foreground">Download Trend</h2>
				<p className="mt-1 text-sm text-muted-foreground">Daily downloads over time.</p>
			</div>
			{chartData.length > 0 ? (
				<ChartContainer config={chartConfig} className="h-[280px] w-full sm:h-[340px]">
					<LineChart data={chartData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
						<CartesianGrid vertical={false} />
						<XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
						<YAxis tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} width={42} />
						<ChartTooltip
							content={<ChartTooltipContent formatter={(value) => formatCompactNumber(Number(value ?? 0))} />}
						/>
						<Line
							type="monotone"
							dataKey="downloads"
							stroke="var(--color-downloads)"
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 4 }}
						/>
					</LineChart>
				</ChartContainer>
			) : (
				<div className="flex h-[280px] items-center justify-center rounded-md border border-dashed text-center text-sm text-muted-foreground sm:h-[340px]">
					Download trend data is not available for this package yet.
				</div>
			)}
		</section>
	);
}
