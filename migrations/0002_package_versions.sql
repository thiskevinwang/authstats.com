CREATE TABLE IF NOT EXISTS package_versions (
	package_id TEXT NOT NULL,
	version TEXT NOT NULL,
	published_at TEXT,
	dist_tag TEXT,
	source TEXT NOT NULL,
	fetched_at TEXT NOT NULL,
	PRIMARY KEY (package_id, version),
	FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_package_versions_package_published ON package_versions (package_id, published_at DESC);

CREATE TABLE IF NOT EXISTS version_download_snapshots (
	package_id TEXT NOT NULL,
	version TEXT NOT NULL,
	metric TEXT NOT NULL,
	date TEXT NOT NULL,
	downloads INTEGER NOT NULL,
	source TEXT NOT NULL,
	fetched_at TEXT NOT NULL,
	PRIMARY KEY (package_id, version, metric, date),
	FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_version_download_snapshots_package_date ON version_download_snapshots (package_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_version_download_snapshots_package_downloads ON version_download_snapshots (package_id, downloads DESC);

