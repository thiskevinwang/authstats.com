import { notFound } from "next/navigation";
import { PackageDetailView } from "@/components/package-detail-view";
import { getPackageDetailDataByRegistryPackage } from "@/lib/package-detail-data";
import { packageNameFromSegments } from "@/lib/package-routes";

export const dynamic = "force-dynamic";

export default async function RegistryPackagePage({
	params,
}: {
	params: Promise<{ registry: string; packageName: string[] }>;
}) {
	const { registry, packageName } = await params;
	const data = await getPackageDetailDataByRegistryPackage(registry, packageNameFromSegments(packageName));

	if (!data) {
		notFound();
	}

	return <PackageDetailView data={data} />;
}
