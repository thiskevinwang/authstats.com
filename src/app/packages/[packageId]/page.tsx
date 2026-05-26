import { notFound, redirect } from "next/navigation";
import { AUTH_PACKAGES } from "@/lib/package-catalog";
import { packageHref } from "@/lib/package-routes";

export const dynamic = "force-dynamic";

export default async function PackageRedirectPage({ params }: { params: Promise<{ packageId: string }> }) {
	const { packageId } = await params;
	const pkg = AUTH_PACKAGES.find((candidate) => candidate.id === packageId);

	if (!pkg) {
		notFound();
	}

	redirect(packageHref(pkg));
}
