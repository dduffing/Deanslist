import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

function App() {
  const [status, setStatus] = useState("Checking connection...");
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkConnection() {
      const { error: queryError } = await supabase
        .from("regions")
        .select("id")
        .limit(1);

      if (queryError) {
        setStatus("Connected to Supabase, but schema is not ready yet.");
        setError(queryError.message);
        return;
      }

      setStatus("Supabase is connected and reachable.");
    }

    checkConnection();
  }, []);

  return (
    <main className="app-shell">
      <h1>Modern Craigslist MVP</h1>
      <p className="subtitle">React + Vite + Supabase starter</p>

      <section className="card">
        <h2>Connection status</h2>
        <p>{status}</p>
        {error ? <pre className="error">{error}</pre> : null}
      </section>

      <section className="card">
        <h2>Next implementation milestones</h2>
        <ol>
          <li>Apply SQL migrations from `supabase/migrations`.</li>
          <li>Build region selector and listing feed.</li>
          <li>Add auth and listing create/edit pages.</li>
        </ol>
      </section>
    </main>
  );
}

export default App;
