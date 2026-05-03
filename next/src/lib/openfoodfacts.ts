/**
 * Open Food Facts API client
 * https://wiki.openfoodfacts.org/API
 */

export interface OFFProduct {
  code: string;
  name: string;
  brands: string;
  image_url: string | null;
  nutriments: {
    calories: number;
    proteins: number;
    fat: number;
    carbs: number;
    fiber: number;
  };
  serving_size: string | null;
}

const USER_AGENT = "PersonalDashboard/1.0 (pd.taras.cloud)";
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<{ products: OFFProduct[]; count: number }>>();
const barcodeCache = new Map<string, CacheEntry<OFFProduct | null>>();

function isExpired<T>(entry: CacheEntry<T> | undefined): entry is undefined {
  if (!entry) return true;
  if (Date.now() > entry.expiresAt) return true;
  return false;
}

function mapProduct(raw: Record<string, unknown>): OFFProduct {
  const nutriments = (raw.nutriments ?? {}) as Record<string, unknown>;
  return {
    code: String(raw.code ?? ""),
    name: String(raw.product_name ?? raw.product_name_en ?? ""),
    brands: String(raw.brands ?? ""),
    image_url: typeof raw.image_front_small_url === "string"
      ? raw.image_front_small_url
      : typeof raw.image_url === "string"
        ? raw.image_url
        : null,
    nutriments: {
      calories: Number(nutriments["energy-kcal_100g"] ?? 0),
      proteins: Number(nutriments["proteins_100g"] ?? 0),
      fat: Number(nutriments["fat_100g"] ?? 0),
      carbs: Number(nutriments["carbohydrates_100g"] ?? 0),
      fiber: Number(nutriments["fiber_100g"] ?? 0),
    },
    serving_size: typeof raw.serving_size === "string" ? raw.serving_size : null,
  };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function searchProducts(
  query: string,
  page = 1,
  locale = "en",
): Promise<{ products: OFFProduct[]; count: number }> {
  const cacheKey = `${query}::${page}::${locale}`;
  const cached = searchCache.get(cacheKey);
  if (!isExpired(cached)) return cached.data;

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page=${page}&page_size=20&lc=${locale}`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    return { products: [], count: 0 };
  }

  const json = (await res.json()) as { products?: Record<string, unknown>[]; count?: number };
  const products = (json.products ?? []).map(mapProduct).filter((p) => p.name.length > 0);
  const count = Number(json.count ?? 0);

  const result = { products, count };
  searchCache.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });

  // Evict stale entries periodically (simple: keep max 200)
  if (searchCache.size > 200) {
    const now = Date.now();
    for (const [key, entry] of searchCache) {
      if (now > entry.expiresAt) searchCache.delete(key);
    }
  }

  return result;
}

export async function getProductByBarcode(barcode: string): Promise<OFFProduct | null> {
  const cached = barcodeCache.get(barcode);
  if (!isExpired(cached)) return cached.data;

  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;

  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { status?: number; product?: Record<string, unknown> };
  if (json.status !== 1 || !json.product) {
    barcodeCache.set(barcode, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const product = mapProduct(json.product);
  barcodeCache.set(barcode, { data: product, expiresAt: Date.now() + CACHE_TTL_MS });

  return product;
}
