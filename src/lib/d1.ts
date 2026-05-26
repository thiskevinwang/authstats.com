import { Result, TaggedError, type Result as ResultType } from "better-result";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import { AUTH_PACKAGES, type AuthPackage } from "@/lib/package-catalog";
import type { DownloadSnapshotInput } from "@/lib/download-fetchers";
import {
	downloadSnapshots,
	etlRuns,
	packages as packagesTable,
	packageVersions,
	versionDownloadSnapshots,
} from "@/lib/db-schema";
import type { PackageVersionInput, VersionDownloadSnapshotInput } from "@/lib/version-fetchers";

const writeChunkSize = 10;

const registrySchema = z.enum([
	"npm",
	"pypi",
	"rubygems",
	"packagist",
	"maven",
	"nuget",
	"go",
	"crates",
	"hex",
	"pub",
	"swiftpackageindex",
]);

const packageRowSchema = z.object({
	id: z.string().min(1),
	ecosystem: z.string().min(1),
	name: z.string().min(1),
	target: z.string().min(1),
	category: z.string().min(1),
	provider: z.string().min(1),
	registry: registrySchema,
	sourceUrl: z.string().url(),
}) satisfies z.ZodType<AuthPackage>;

const snapshotMetricSchema = z.enum(["daily", "weekly", "monthly", "recent", "total"]);

const snapshotRowSchema = z.object({
	packageId: z.string().min(1),
	metric: snapshotMetricSchema,
	date: z.string().min(1),
	downloads: z.number().int().nonnegative(),
	source: z.string().min(1),
	fetchedAt: z.string().min(1),
});

const etlRunRowSchema = z.object({
	id: z.string().min(1),
	startedAt: z.string().min(1),
	completedAt: z.string().min(1).nullable(),
	status: z.string().min(1),
	packagesTotal: z.number().int().nonnegative(),
	packagesUpdated: z.number().int().nonnegative(),
	errorsJson: z.string().nullable(),
});

const packageVersionRowSchema = z.object({
	packageId: z.string().min(1),
	version: z.string().min(1),
	publishedAt: z.string().nullable(),
	distTag: z.string().nullable(),
	source: z.string().min(1),
	fetchedAt: z.string().min(1),
});

const versionDownloadSnapshotRowSchema = z.object({
	packageId: z.string().min(1),
	version: z.string().min(1),
	metric: z.enum(["weekly"]),
	date: z.string().min(1),
	downloads: z.number().int().nonnegative(),
	source: z.string().min(1),
	fetchedAt: z.string().min(1),
});

export type PackageRow = z.infer<typeof packageRowSchema>;
export type SnapshotRow = z.infer<typeof snapshotRowSchema>;
export type EtlRunRow = z.infer<typeof etlRunRowSchema>;
export type PackageVersionRow = z.infer<typeof packageVersionRowSchema>;
export type VersionDownloadSnapshotRow = z.infer<typeof versionDownloadSnapshotRowSchema>;

export class DatabaseQueryError extends TaggedError("DatabaseQueryError")<{
	operation: string;
	message: string;
	cause: unknown;
}>() {}

export class DatabaseParseError extends TaggedError("DatabaseParseError")<{
	operation: string;
	message: string;
	cause: unknown;
}>() {}

export type D1Error = DatabaseQueryError | DatabaseParseError;

export async function upsertPackageCatalog(
	db: D1Database,
	packages: AuthPackage[] = AUTH_PACKAGES,
): Promise<ResultType<void, D1Error>> {
	const packagesResult = parseWithSchema(z.array(packageRowSchema), packages, "parse package catalog");
	if (Result.isError(packagesResult)) {
		return packagesResult;
	}

	return tryQuery("upsert package catalog", async () => {
		for (const packageChunk of chunks(packagesResult.value, writeChunkSize)) {
			await drizzle(db)
				.insert(packagesTable)
				.values(packageChunk)
				.onConflictDoUpdate({
					target: packagesTable.id,
					set: {
						ecosystem: sql`excluded.ecosystem`,
						name: sql`excluded.name`,
						target: sql`excluded.target`,
						category: sql`excluded.category`,
						provider: sql`excluded.provider`,
						registry: sql`excluded.registry`,
						sourceUrl: sql`excluded.source_url`,
					},
				})
				.run();
		}
	});
}

export async function insertSnapshots(
	db: D1Database,
	snapshots: DownloadSnapshotInput[],
): Promise<ResultType<void, D1Error>> {
	const snapshotsResult = parseWithSchema(z.array(snapshotRowSchema), snapshots, "parse download snapshots");
	if (Result.isError(snapshotsResult)) {
		return snapshotsResult;
	}

	if (snapshotsResult.value.length === 0) {
		return Result.ok();
	}

	return tryQuery("insert download snapshots", async () => {
		for (const snapshotChunk of chunks(snapshotsResult.value, writeChunkSize)) {
			await drizzle(db)
				.insert(downloadSnapshots)
				.values(snapshotChunk)
				.onConflictDoUpdate({
					target: [downloadSnapshots.packageId, downloadSnapshots.metric, downloadSnapshots.date],
					set: {
						downloads: sql`excluded.downloads`,
						source: sql`excluded.source`,
						fetchedAt: sql`excluded.fetched_at`,
					},
				})
				.run();
		}
	});
}

export async function recordEtlRun(db: D1Database, run: EtlRunRow): Promise<ResultType<void, D1Error>> {
	const runResult = parseWithSchema(etlRunRowSchema, run, "parse run record");
	if (Result.isError(runResult)) {
		return runResult;
	}

	return tryQuery("record run", async () => {
		await drizzle(db)
			.insert(etlRuns)
			.values(runResult.value)
			.onConflictDoUpdate({
				target: etlRuns.id,
				set: {
					completedAt: sql`excluded.completed_at`,
					status: sql`excluded.status`,
					packagesTotal: sql`excluded.packages_total`,
					packagesUpdated: sql`excluded.packages_updated`,
					errorsJson: sql`excluded.errors_json`,
				},
			})
			.run();
	});
}

export async function upsertPackageVersions(
	db: D1Database,
	versions: PackageVersionInput[],
): Promise<ResultType<void, D1Error>> {
	const versionsResult = parseWithSchema(z.array(packageVersionRowSchema), versions, "parse package versions");
	if (Result.isError(versionsResult)) {
		return versionsResult;
	}

	if (versionsResult.value.length === 0) {
		return Result.ok();
	}

	return tryQuery("upsert package versions", async () => {
		for (const versionChunk of chunks(versionsResult.value, writeChunkSize)) {
			await drizzle(db)
				.insert(packageVersions)
				.values(versionChunk)
				.onConflictDoUpdate({
					target: [packageVersions.packageId, packageVersions.version],
					set: {
						publishedAt: sql`excluded.published_at`,
						distTag: sql`excluded.dist_tag`,
						source: sql`excluded.source`,
						fetchedAt: sql`excluded.fetched_at`,
					},
				})
				.run();
		}
	});
}

export async function insertVersionDownloadSnapshots(
	db: D1Database,
	snapshots: VersionDownloadSnapshotInput[],
): Promise<ResultType<void, D1Error>> {
	const snapshotsResult = parseWithSchema(
		z.array(versionDownloadSnapshotRowSchema),
		snapshots,
		"parse version download snapshots",
	);
	if (Result.isError(snapshotsResult)) {
		return snapshotsResult;
	}

	if (snapshotsResult.value.length === 0) {
		return Result.ok();
	}

	return tryQuery("insert version download snapshots", async () => {
		for (const snapshotChunk of chunks(snapshotsResult.value, writeChunkSize)) {
			await drizzle(db)
				.insert(versionDownloadSnapshots)
				.values(snapshotChunk)
				.onConflictDoUpdate({
					target: [
						versionDownloadSnapshots.packageId,
						versionDownloadSnapshots.version,
						versionDownloadSnapshots.metric,
						versionDownloadSnapshots.date,
					],
					set: {
						downloads: sql`excluded.downloads`,
						source: sql`excluded.source`,
						fetchedAt: sql`excluded.fetched_at`,
					},
				})
				.run();
		}
	});
}

export async function readPackages(db: D1Database): Promise<ResultType<PackageRow[], D1Error>> {
	const rowsResult = await tryQuery("read packages", async () =>
		drizzle(db).select().from(packagesTable).orderBy(packagesTable.ecosystem, packagesTable.name),
	);
	if (Result.isError(rowsResult)) {
		return rowsResult;
	}

	return parseWithSchema(z.array(packageRowSchema), rowsResult.value, "parse packages");
}

export async function readSnapshots(db: D1Database): Promise<ResultType<SnapshotRow[], D1Error>> {
	const rowsResult = await tryQuery("read snapshots", async () =>
		drizzle(db)
			.select()
			.from(downloadSnapshots)
			.where(gte(downloadSnapshots.date, sql<string>`date('now', '-120 days')`))
			.orderBy(downloadSnapshots.date),
	);
	if (Result.isError(rowsResult)) {
		return rowsResult;
	}

	return parseWithSchema(z.array(snapshotRowSchema), rowsResult.value, "parse snapshots");
}

export async function readLatestRuns(db: D1Database): Promise<ResultType<EtlRunRow[], D1Error>> {
	const rowsResult = await tryQuery("read latest runs", async () =>
		drizzle(db).select().from(etlRuns).orderBy(desc(etlRuns.startedAt)).limit(5),
	);
	if (Result.isError(rowsResult)) {
		return rowsResult;
	}

	return parseWithSchema(z.array(etlRunRowSchema), rowsResult.value, "parse latest runs");
}

export async function readPackageVersions(
	db: D1Database,
	packageId: string,
): Promise<ResultType<PackageVersionRow[], D1Error>> {
	const rowsResult = await tryQuery("read package versions", async () =>
		drizzle(db)
			.select()
			.from(packageVersions)
			.where(eq(packageVersions.packageId, packageId))
			.orderBy(desc(packageVersions.publishedAt))
			.limit(80),
	);
	if (Result.isError(rowsResult)) {
		return rowsResult;
	}

	return parseWithSchema(z.array(packageVersionRowSchema), rowsResult.value, "parse package versions");
}

export async function readVersionDownloadSnapshots(
	db: D1Database,
	packageId: string,
): Promise<ResultType<VersionDownloadSnapshotRow[], D1Error>> {
	const rowsResult = await tryQuery("read version download snapshots", async () =>
		drizzle(db)
			.select()
			.from(versionDownloadSnapshots)
			.where(
				and(
					eq(versionDownloadSnapshots.packageId, packageId),
					gte(versionDownloadSnapshots.date, sql<string>`date('now', '-180 days')`),
				),
			)
			.orderBy(desc(versionDownloadSnapshots.date), desc(versionDownloadSnapshots.downloads))
			.limit(2000),
	);
	if (Result.isError(rowsResult)) {
		return rowsResult;
	}

	return parseWithSchema(
		z.array(versionDownloadSnapshotRowSchema),
		rowsResult.value,
		"parse version download snapshots",
	);
}

function parseWithSchema<T>(
	schema: z.ZodType<T>,
	value: unknown,
	operation: string,
): ResultType<T, DatabaseParseError> {
	const parseResult = schema.safeParse(value);
	if (parseResult.success) {
		return Result.ok(parseResult.data);
	}

	return Result.err(
		new DatabaseParseError({
			operation,
			message: errorMessage(parseResult.error),
			cause: parseResult.error,
		}),
	);
}

async function tryQuery<T>(operation: string, query: () => Promise<T>): Promise<ResultType<T, DatabaseQueryError>> {
	return Result.tryPromise({
		try: query,
		catch: (cause) =>
			new DatabaseQueryError({
				operation,
				message: errorMessage(cause),
				cause,
			}),
	});
}

function chunks<T>(items: T[], size: number) {
	const result: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size));
	}
	return result;
}

function errorMessage(cause: unknown) {
	if (cause instanceof z.ZodError) {
		return cause.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; ");
	}

	if (cause instanceof Error) {
		return cause.message;
	}

	return String(cause);
}
