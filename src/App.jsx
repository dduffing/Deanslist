import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { getSupabaseClient } from "./lib/supabaseClient";

const REGION_STORAGE_KEY = "selected_region_id";

function App() {
  const [status, setStatus] = useState("Checking connection...");
  const [error, setError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [regions, setRegions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [listings, setListings] = useState([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [myListings, setMyListings] = useState([]);
  const [isLoadingMyListings, setIsLoadingMyListings] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

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
      const { data: categoryRows, error: categoryError } = await client
        .from("categories")
        .select("id, slug, name, parent_id")
        .is("parent_id", null)
        .order("name", { ascending: true });

      if (queryError || categoryError) {
        setStatus("Connected to Supabase, but schema is not ready yet.");
        setError(queryError?.message ?? categoryError?.message ?? "Schema query failed.");
        return;
      }

      const safeRegions = regionRows ?? [];
      const safeCategories = categoryRows ?? [];
      setRegions(safeRegions);
      setCategories(safeCategories);

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
    setIsAccountMenuOpen(false);
  }

  function connectionToneClass() {
    if (error) return "tone-error";
    if (status.includes("reachable")) return "tone-ok";
    return "tone-warn";
  }

  function handleLoadListingsForCategory(categorySlug) {
    async function run() {
      const { client, configError } = getSupabaseClient();
      if (configError || !client || !selectedRegionId) return;

      setIsLoadingListings(true);
      let query = client
        .from("listings")
        .select("id, title, price_label, price_min, price_max, location_text, created_at")
        .eq("region_id", selectedRegionId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(24);

      if (categorySlug) {
        const category = categories.find((item) => item.slug === categorySlug);
        if (!category) {
          setListings([]);
          setIsLoadingListings(false);
          return;
        }
        query = query.eq("category_id", category.id);
      }

      const { data, error: listingsError } = await query;
      if (listingsError) {
        setError(listingsError.message);
        setListings([]);
      } else {
        setListings(data ?? []);
      }
      setIsLoadingListings(false);
    }
    run();
  }

  function ListingsSection({ activeCategorySlug }) {
    const navigate = useNavigate();
    const categoryLabel =
      activeCategorySlug &&
      categories.find((item) => item.slug === activeCategorySlug)?.name;

    useEffect(() => {
      handleLoadListingsForCategory(activeCategorySlug);
    }, [activeCategorySlug]);

    return (
      <section className="card">
        <div className="row wrap">
          <h2>Recent listings{categoryLabel ? ` - ${categoryLabel}` : ""}</h2>
          <select
            className="region-select"
            value={activeCategorySlug ?? ""}
            onChange={(event) => {
              const slug = event.target.value;
              navigate(slug ? `/category/${slug}` : "/");
            }}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="category-links">
          <Link to="/" className={!activeCategorySlug ? "category-link active" : "category-link"}>
            All
          </Link>
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              className={
                activeCategorySlug === category.slug
                  ? "category-link active"
                  : "category-link"
              }
            >
              {category.name}
            </Link>
          ))}
        </div>

        {isLoadingListings ? <p>Loading listings...</p> : null}
        {!isLoadingListings && listings.length === 0 ? (
          <p>No listings found for this region/category yet.</p>
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
    );
  }

  function AllListingsRoute() {
    return <ListingsSection activeCategorySlug={null} />;
  }

  function CategoryListingsRoute() {
    const { categorySlug } = useParams();
    const isValid = categories.some((item) => item.slug === categorySlug);
    if (!isValid && categories.length > 0) {
      return <Navigate to="/" replace />;
    }
    return <ListingsSection activeCategorySlug={categorySlug} />;
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <h1>Modern Craigslist MVP</h1>
          <p className="subtitle">React + Vite + Supabase starter</p>
        </div>
        <div className="top-ribbon">
          <select
            className="region-select region-select-ribbon"
            value={selectedRegionId}
            onChange={handleRegionChange}
            disabled={regions.length === 0}
          >
            {regions.length === 0 ? (
              <option value="">No region</option>
            ) : (
              regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.display_name}
                </option>
              ))
            )}
          </select>
          <span
            className={`status-pill ${connectionToneClass()}`}
            title={error ? `${status} - ${error}` : status}
            aria-label={status}
          >
            <span className="dot" />
            DB
          </span>
          <div className="account-menu-wrap">
            <button
              type="button"
              className="icon-pill"
              onClick={() => setIsAccountMenuOpen((prev) => !prev)}
            >
              {session ? "👤" : "🔐"}
            </button>
            {isAccountMenuOpen ? (
              <div className="account-popover">
                <h3>Account</h3>
                {isAuthLoading ? <p>Checking session...</p> : null}
                {!isAuthLoading && !session ? (
                  <form className="auth-form compact">
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
                        Create
                      </button>
                    </div>
                  </form>
                ) : null}
                {!isAuthLoading && session ? (
                  <>
                    <p className="hint">
                      Signed in as <strong>{session.user.email}</strong>
                    </p>
                    <button type="button" onClick={handleSignOut}>
                      Sign out
                    </button>
                    <h4>My listings</h4>
                    {isLoadingMyListings ? <p>Loading...</p> : null}
                    {!isLoadingMyListings && myListings.length === 0 ? (
                      <p>No listings yet.</p>
                    ) : null}
                    <ul className="simple-list compact">
                      {myListings.slice(0, 5).map((listing) => (
                        <li key={listing.id}>
                          <span>{listing.title}</span>
                          <span className="badge">{listing.status}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {authMessage ? <p className="hint">{authMessage}</p> : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<AllListingsRoute />} />
        <Route path="/category/:categorySlug" element={<CategoryListingsRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {error ? <pre className="error">{error}</pre> : null}
    </main>
  );
}

export default App;
