import snapshot from "@/lib/stores/buyme-catalog-snapshot.json";
import { BUYME_CATALOGS, type CatalogBrand, type CatalogSummary } from "@/lib/stores/lookup";
import type { StoredCatalog } from "@/lib/stores/catalog-store";

type SnapshotFile = {
  fetchedAt: string;
  source: string;
  catalogs: Record<string, { label: string; sourceLastModified: string | null; brands: CatalogBrand[] }>;
};

const file = snapshot as SnapshotFile;

/** Brands shipped with the app, used when the database cache is empty or older. */
export function bundledCatalog(id: string): StoredCatalog | null {
  const row = file.catalogs[id];
  if (!row || !Array.isArray(row.brands) || !row.brands.length) return null;
  const fetchedAt = Date.parse(file.fetchedAt);
  if (!Number.isFinite(fetchedAt)) return null;
  const known = BUYME_CATALOGS.find((item) => item.id === id);
  const brands = row.brands.filter(
    (brand) => brand && typeof brand.title === "string" && brand.title.trim().length >= 2,
  );
  if (!brands.length) return null;
  const summary: CatalogSummary = {
    id,
    label: row.label?.trim() || known?.label || "BuyMe",
    titles: brands.map((brand) => brand.title),
    brands: brands.map((brand) => ({
      title: brand.title,
      aliases: Array.isArray(brand.aliases) ? brand.aliases.filter((alias) => typeof alias === "string") : [],
    })),
  };
  return {
    summary,
    fetchedAt,
    lastModified: row.sourceLastModified ?? null,
  };
}

export function bundledCatalogFetchedAt(): string {
  return file.fetchedAt;
}

export function bundledCatalogSource(): string {
  return file.source;
}
