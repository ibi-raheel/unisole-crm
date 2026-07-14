"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Instant load-status filter — picking a status applies it immediately.
export function LoadFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";

  function navigate(next: string) {
    const params = new URLSearchParams();
    if (next) params.set("status", next);
    const qs = params.toString();
    router.push(qs ? `/loads?${qs}` : "/loads");
  }

  return (
    <div className="filters">
      <div className="field" style={{ margin: 0 }}>
        <label className="label" htmlFor="lstatus">
          Load status
        </label>
        <select
          className="input"
          id="lstatus"
          value={status}
          onChange={(e) => navigate(e.target.value)}
        >
          <option value="">All</option>
          <option value="En Route">En Route</option>
          <option value="Delivered">Delivered</option>
        </select>
      </div>
      {status && (
        <button
          type="button"
          className="btn"
          onClick={() => navigate("")}
          style={{ alignSelf: "flex-end" }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
