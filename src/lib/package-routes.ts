import type { AuthPackage } from "@/lib/package-catalog";

export function packageHref(pkg: Pick<AuthPackage, "name" | "registry">) {
	return `/registries/${encodeURIComponent(pkg.registry)}/packages/${pkg.name.split("/").map(encodePackageSegment).join("/")}`;
}

export function packageNameFromSegments(segments: string[]) {
	return segments.map(decodePackageSegment).join("/");
}

function encodePackageSegment(segment: string) {
	return encodeURIComponent(segment).replace(/%40/g, "@");
}

function decodePackageSegment(segment: string) {
	try {
		return decodeURIComponent(segment);
	} catch {
		return segment;
	}
}
