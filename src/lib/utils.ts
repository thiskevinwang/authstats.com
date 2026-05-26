import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatCompactNumber(value: number) {
	return Intl.NumberFormat("en", {
		notation: "compact",
		maximumFractionDigits: value >= 1000 ? 1 : 0,
	}).format(value);
}

export function formatInteger(value: number) {
	return Intl.NumberFormat("en").format(Math.round(value));
}

export function toIsoDate(date: Date | string | number) {
	return new Date(date).toISOString().slice(0, 10);
}

export function daysAgo(days: number, from = new Date()) {
	const date = new Date(from);
	date.setUTCDate(date.getUTCDate() - days);
	return toIsoDate(date);
}

export function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
