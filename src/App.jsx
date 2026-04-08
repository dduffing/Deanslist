import { useEffect, useState } from "react";
import { getSupabaseClient } from "./lib/supabaseClient";

const REGION_STORAGE_KEY = "selected_region_id";

function App() {
  const [status, setStatus] = useState("Checking connection...");
  const [error, setError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [regions, setRegions] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [listings, setListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [myListings, setMyListings] = useState([]);
  const [isLoadingMyListings, setIsLoadingMyListings] = useState(false);

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
    const { client, configError } = getSupabaseClient();
    if (configError || !client) {
      setIsAuthLoading(false);
      return;
    }

    let isMounted = true;

    async function initSession() {
      const { data, error: sessionError } = await client.auth.getSession();
      if (!isMounted) return;

      if (sessionError) {
        setError(sessionError.message);
      } else {
        setSession(data.session ?? null);
      }
      setIsAuthLoading(false);
    }

    initSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
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

  useEffect(() => {
    async function loadMyListings() {
      const { client, configError } = getSupabaseClient();
      if (configError || !client || !session?.user?.id) {
        setMyListings([]);
        return;
      }

      setIsLoadingMyListings(true);
      const { data, error: myListingsError } = await client
        .from("listings")
        .select("id, title, status, created_at")
        .eq("seller_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (myListingsError) {
        setError(myListingsError.message);
        setMyListings([]);
        setIsLoadingMyListings(false);
        return;
      }

      setMyListings(data ?? []);
      setIsLoadingMyListings(false);
    }

    loadMyListings();
  }, [session]);

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

  async function handleSignUp(event) {
    event.preventDefault();
    const { client, configError } = getSupabaseClient();
    if (configError || !client) {
      setAuthMessage("Supabase auth is not configured.");
      return;
    }

    const { error: signUpError } = await client.auth.signUp({
      email: emailInput.trim(),
      password: passwordInput,
    });

    if (signUpError) {
      setAuthMessage(signUpError.message);
      return;
    }

    setAuthMessage(
      "Sign-up submitted. Check your email for confirmation if required."
    );
  }

  async function handleSignIn(event) {
    event.preventDefault();
    const { client, configError } = getSupabaseClient();
    if (configError || !client) {
      setAuthMessage("Supabase auth is not configured.");
      return;
    }

    const { error: signInError } = await client.auth.signInWithPassword({
      email: emailInput.trim(),
      password: passwordInput,
    });

    if (signInError) {
      setAuthMessage(signInError.message);
      return;
    }

    setAuthMessage("Signed in successfully.");
  }

  async function handleSignOut() {
    const { client, configError } = getSupabaseClient();
    if (configError || !client) {
      setAuthMessage("Supabase auth is not configured.");
      return;
    }

    const { error: signOutError } = await client.auth.signOut();
    if (signOutError) {
      setAuthMessage(signOutError.message);
      return;
    }

    setAuthMessage("Signed out.");
    setMyListings([]);
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
        <h2>Account</h2>
        {isAuthLoading ? <p>Checking session...</p> : null}
        {!isAuthLoading && !session ? (
          <form className="auth-form">
            <label>
              Email
              <input
                type="email"
                value={emailInput}
                onChange={(event) => setEmailInput(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={passwordInput}
                onChange={(event) => setPasswordInput(event.target.value)}
                placeholder="At least 6 characters"
                minLength={6}
                required
              />
            </label>
            <div className="auth-actions">
              <button type="button" onClick={handleSignIn}>
                Sign in
              </button>
              <button type="button" className="secondary" onClick={handleSignUp}>
                Create account
              </button>
            </div>
            <p className="hint">
              After sign-up, check your email and confirm your account before
              signing in. If a link opens localhost, update Supabase Auth Site URL
              and Redirect URLs to this Netlify domain.
            </p>
          </form>
        ) : null}

        {!isAuthLoading && session ? (
          <div className="account-shell">
            <p>
              Signed in as <strong>{session.user.email}</strong>
            </p>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        ) : null}

        {authMessage ? <p className="hint">{authMessage}</p> : null}
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

      <section className="card">
        <h2>My account</h2>
        {!session ? (
          <p>Sign in to view your listings dashboard.</p>
        ) : (
          <>
            {isLoadingMyListings ? <p>Loading your listings...</p> : null}
            {!isLoadingMyListings && myListings.length === 0 ? (
              <p>You have no listings yet.</p>
            ) : null}
            <ul className="simple-list">
              {myListings.map((listing) => (
                <li key={listing.id}>
                  <span>{listing.title}</span>
                  <span className="badge">{listing.status}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

export default App;
