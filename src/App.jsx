import { useEffect, useState } from "react";
import { getSupabaseClient } from "./lib/supabaseClient";

const REGION_STORAGE_KEY = "selected_region_id";

function App() {
  const [status, setStatus] = useState("Checking connection...");
  const [error, setError] = useState("");
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [listings, setListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);

  useEffect(() => {
    async function checkConnection() {
      const { client, configError } = getSupabaseClient();

      if (configError) {
        setStatus("App loaded, but Supabase is not configured yet.");
        setError(configError);
        return;
      }

      if (!client) {
        setStatus("App loaded, but Supabase client is unavailable.");
        setError("Unexpected Supabase client state.");
        return;
      }

      const { data: regionRows, error: queryError } = await client
        .from("regions")
        .select("id, display_name, slug")
        .order("display_name", { ascending: true });

      if (queryError) {
        setStatus("Connected to Supabase, but schema is not ready yet.");
        setError(queryError.message);
        return;
      }

      const safeRegions = regionRows ?? [];
      setRegions(safeRegions);

      if (safeRegions.length === 0) {
        setStatus("Supabase is connected, but no regions are seeded yet.");
        return;
      }

      const savedRegionId = window.localStorage.getItem(REGION_STORAGE_KEY);
      const selectedRegionExists = safeRegions.some(
        (region) => region.id === savedRegionId
      );

      const nextRegionId = selectedRegionExists ? savedRegionId : safeRegions[0].id;
      setSelectedRegionId(nextRegionId);
      setStatus("Supabase is connected and reachable.");
    }

    checkConnection();
  }, []);

  useEffect(() => {
    async function loadListings() {
      const { client, configError } = getSupabaseClient();

      if (configError || !client || !selectedRegionId) {
        setListings([]);
        return;
      }

      setIsLoadingListings(true);

      const { data, error: listingsError } = await client
        .from("listings")
        .select("id, title, price_label, price_min, price_max, location_text, created_at")
        .eq("region_id", selectedRegionId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(24);

      if (listingsError) {
        setError(listingsError.message);
        setListings([]);
        setIsLoadingListings(false);
        return;
      }

      setListings(data ?? []);
      setIsLoadingListings(false);
    }

    loadListings();
  }, [selectedRegionId]);

  function handleRegionChange(event) {
    const nextRegionId = event.target.value;
    setSelectedRegionId(nextRegionId);
    window.localStorage.setItem(REGION_STORAGE_KEY, nextRegionId);
  }

  function formatPrice(listing) {
    if (listing.price_label) return listing.price_label;
    if (listing.price_min && listing.price_max) {
      return `$${Number(listing.price_min)} - $${Number(listing.price_max)}`;
    }
    if (listing.price_min) return `$${Number(listing.price_min)}`;
    return "Contact for price";
  }

  return (
    <main className="app-shell">
      <h1>Modern Craigslist MVP</h1>
      <p className="subtitle">React + Vite + Supabase starter</p>

      <section className="card">
        <div className="row">
          <h2>Region</h2>
          <select
            className="region-select"
            value={selectedRegionId}
            onChange={handleRegionChange}
            disabled={regions.length === 0}
          >
            {regions.length === 0 ? (
              <option value="">No regions available</option>
            ) : (
              regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.display_name}
                </option>
              ))
            )}
          </select>
        </div>
      </section>

      <section className="card">
        <h2>Connection status</h2>
        <p>{status}</p>
        {error ? <pre className="error">{error}</pre> : null}
      </section>

      <section className="card">
        <h2>Recent listings</h2>
        {isLoadingListings ? <p>Loading listings...</p> : null}
        {!isLoadingListings && listings.length === 0 ? (
          <p>No listings found for this region yet.</p>
        ) : null}
        <div className="listing-grid">
          {listings.map((listing) => (
            <article key={listing.id} className="listing-card">
              <h3>{listing.title}</h3>
              <p className="price">{formatPrice(listing)}</p>
              <p className="meta">{listing.location_text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;
