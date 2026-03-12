"use client";

import { getClubWines } from "@/lib/services/wine-service";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Package, Wine as WineIcon, X } from "lucide-react";

type WineItem = {
  id: string;
  name: string;
  winery: string;
  vintage?: number;
  image_url?: string;
  msrp?: number;
  store_price?: number;
  club_price?: number;
  available_for_club?: boolean;
  varietal?: string;
  region?: string;
  type?: "red" | "white" | "rosé" | "sparkling" | "dessert" | "orange";
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-stone-200 ${className}`} />;
}

function WineBottleCard({
  wine,
  showPricing = false,
  onClick,
}: {
  wine: WineItem;
  showPricing?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full overflow-hidden rounded-3xl border border-stone-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-stone-100">
        {wine.image_url ? (
          <img
            src={wine.image_url}
            alt={wine.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400">
            <Package className="h-10 w-10" />
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="truncate font-semibold text-stone-800">{wine.name}</p>
        <p className="mt-1 text-sm text-stone-500">
          {wine.winery}
          {wine.vintage ? ` · ${wine.vintage}` : ""}
        </p>

        <div className="mt-2 flex flex-wrap gap-1">
          {wine.type && (
            <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-700">
              {wine.type}
            </span>
          )}
          {wine.varietal && (
            <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-700">
              {wine.varietal}
            </span>
          )}
        </div>

        {showPricing && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            {wine.msrp != null && (
              <span className="text-stone-400 line-through">
                ${wine.msrp.toFixed(2)}
              </span>
            )}
            {wine.store_price != null && (
              <span className="text-stone-500">${wine.store_price.toFixed(2)}</span>
            )}
            {wine.club_price != null && (
              <span className="font-bold text-emerald-700">
                ${wine.club_price.toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}

function WineDetailModal({
  wine,
  open,
  onClose,
}: {
  wine: WineItem | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open || !wine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-stone-800">{wine.name}</h2>
            <p className="text-stone-500">
              {wine.winery}
              {wine.vintage ? ` · ${wine.vintage}` : ""}
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl bg-stone-100 p-2 text-stone-700 transition hover:bg-stone-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl bg-stone-100">
          {wine.image_url ? (
            <img
              src={wine.image_url}
              alt={wine.name}
              className="h-80 w-full object-cover"
            />
          ) : (
            <div className="flex h-80 items-center justify-center text-stone-400">
              <Package className="h-10 w-10" />
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2 text-sm text-stone-600">
          {wine.type && (
            <p>
              Type: <span className="font-medium text-stone-800">{wine.type}</span>
            </p>
          )}
          {wine.varietal && (
            <p>
              Varietal:{" "}
              <span className="font-medium text-stone-800">{wine.varietal}</span>
            </p>
          )}
          {wine.region && (
            <p>
              Region: <span className="font-medium text-stone-800">{wine.region}</span>
            </p>
          )}
          <p>
            Club price:{" "}
            <span className="font-semibold text-stone-800">
              ${wine.club_price?.toFixed(2) ?? "0.00"}
            </span>
          </p>
          <p>
            Store price:{" "}
            <span className="font-semibold text-stone-800">
              ${wine.store_price?.toFixed(2) ?? "0.00"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WineCatalogPage() {
  const [wines, setWines] = useState<WineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedWine, setSelectedWine] = useState<WineItem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadWines = async () => {
      try {
        setLoading(true);
        setError("");

        const data = await getClubWines();
        setWines(data);
      } catch (err) {
        console.error("Failed to load wines:", err);
        setError("Could not load wines.");
      } finally {
        setLoading(false);
      }
    };

    loadWines();
  }, []);

  const filteredWines = useMemo(() => {
    return wines.filter((w) => {
      const q = search.toLowerCase();

      const matchSearch =
        !search ||
        w.name?.toLowerCase().includes(q) ||
        w.winery?.toLowerCase().includes(q) ||
        w.varietal?.toLowerCase().includes(q) ||
        w.region?.toLowerCase().includes(q);

      const matchType = typeFilter === "all" || w.type === typeFilter;

      return matchSearch && matchType;
    });
  }, [wines, search, typeFilter]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-72 rounded-3xl" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f4f2ef]">
        <div className="mx-auto max-w-6xl p-6 lg:p-10">
          <p className="text-red-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f2ef]">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-10">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 lg:text-3xl">
            Wine Catalog
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            Browse wines available for your case
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              placeholder="Search wines, wineries, regions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm text-stone-800 outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-40 rounded-2xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-800 outline-none"
          >
            <option value="all">All Types</option>
            <option value="red">Red</option>
            <option value="white">White</option>
            <option value="rosé">Rosé</option>
            <option value="sparkling">Sparkling</option>
            <option value="dessert">Dessert</option>
            <option value="orange">Orange</option>
          </select>
        </div>

        {filteredWines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <WineIcon className="mb-3 h-12 w-12 text-stone-300" />
            <p className="text-stone-500">No wines match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filteredWines.map((wine, i) => (
              <motion.div
                key={wine.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
              >
                <WineBottleCard
                  wine={wine}
                  showPricing
                  onClick={() => setSelectedWine(wine)}
                />
              </motion.div>
            ))}
          </div>
        )}

        <WineDetailModal
          wine={selectedWine}
          open={!!selectedWine}
          onClose={() => setSelectedWine(null)}
        />
      </div>
    </main>
  );
}