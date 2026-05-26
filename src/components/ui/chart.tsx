"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = {
	[key: string]: {
		label?: React.ReactNode;
		color?: string;
	};
};

type ChartContextProps = {
	config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
	const context = React.useContext(ChartContext);

	if (!context) {
		throw new Error("useChart must be used within a <ChartContainer />");
	}

	return context;
}

export function ChartContainer({
	id,
	className,
	children,
	config,
	...props
}: React.ComponentProps<"div"> & {
	config: ChartConfig;
	children: React.ReactElement;
}) {
	const uniqueId = React.useId();
	const containerRef = React.useRef<HTMLDivElement>(null);
	const [size, setSize] = React.useState({ width: 0, height: 0 });
	const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
	const style = Object.fromEntries(
		Object.entries(config)
			.filter(([, item]) => item.color)
			.map(([key, item]) => [`--color-${key}`, item.color]),
	) as React.CSSProperties;

	React.useEffect(() => {
		const element = containerRef.current;
		if (!element) {
			return;
		}

		const updateSize = () => {
			const rect = element.getBoundingClientRect();
			setSize({
				width: Math.max(0, Math.floor(rect.width)),
				height: Math.max(0, Math.floor(rect.height)),
			});
		};

		const frame = requestAnimationFrame(updateSize);
		const observer = new ResizeObserver(updateSize);
		observer.observe(element);

		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, []);

	return (
		<ChartContext.Provider value={{ config }}>
			<div
				ref={containerRef}
				data-chart={chartId}
				className={cn(
					"flex w-full min-w-0 min-h-56 justify-center text-xs text-muted-foreground",
					"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
					"[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/70",
					"[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
					"[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
					"[&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none",
					className,
				)}
				style={{ ...style, ...props.style }}
				{...props}
			>
				{size.width > 0 && size.height > 0
					? React.cloneElement(children as React.ReactElement<{ width?: number; height?: number }>, {
							width: size.width,
							height: size.height,
						})
					: null}
			</div>
		</ChartContext.Provider>
	);
}

type TooltipPayloadItem = {
	dataKey?: string | number;
	name?: string | number;
	value?: string | number;
	color?: string;
	payload?: Record<string, unknown>;
};

export function ChartTooltipContent({
	active,
	payload,
	label,
	className,
	formatter,
}: {
	active?: boolean;
	payload?: TooltipPayloadItem[];
	label?: string;
	className?: string;
	formatter?: (value: string | number | undefined, name: string) => React.ReactNode;
}) {
	const { config } = useChart();

	if (!active || !payload?.length) {
		return null;
	}

	return (
		<div
			className={cn(
				"min-w-36 rounded-lg border border-border bg-card px-3 py-2 text-card-foreground shadow-xl",
				className,
			)}
		>
			{label ? <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div> : null}
			<div className="grid gap-1.5">
				{payload.map((item) => {
					const key = String(item.dataKey ?? item.name ?? "");
					const itemConfig = config[key];
					const color = item.color ?? itemConfig?.color ?? "var(--foreground)";

					return (
						<div key={key} className="flex items-center justify-between gap-5 text-xs">
							<div className="flex min-w-0 items-center gap-2">
								<span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
								<span className="truncate text-muted-foreground">{itemConfig?.label ?? item.name ?? key}</span>
							</div>
							<span className="font-mono font-medium text-foreground">
								{formatter ? formatter(item.value, key) : item.value}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export const ChartTooltip = RechartsPrimitive.Tooltip;
export const ChartLegend = RechartsPrimitive.Legend;

export function ChartLegendContent({ payload, className }: { payload?: TooltipPayloadItem[]; className?: string }) {
	const { config } = useChart();

	if (!payload?.length) {
		return null;
	}

	return (
		<div className={cn("flex flex-wrap items-center justify-center gap-3 text-xs", className)}>
			{payload.map((item) => {
				const key = String(item.dataKey ?? item.value ?? item.name ?? "");
				const itemConfig = config[key];
				const color = item.color ?? itemConfig?.color ?? "var(--foreground)";

				return (
					<div key={key} className="flex items-center gap-1.5">
						<span className="size-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
						<span>{itemConfig?.label ?? item.value ?? item.name}</span>
					</div>
				);
			})}
		</div>
	);
}
