"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CARRIER_STATUSES } from "@/lib/status";

// Search + status filter for the carriers list. Picking a status applies it
// instantly; typing a name and pressing Enter searches. No separate button.
export function CarrierFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";

  function navigate(nextQ: string, nextStatus: string) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextStatus) params.set("status", nextStatus);
    const qs = params.toString();
    router.push(qs ? `/carriers?${qs}` : "/carriers");
  }

  return (
    <div className="filters">
      <form
        className="field"
        style={{ margin: 0 }}
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "q"
          ) as HTMLInputElement;
          navigate(input.value, status);
        }}
      >
        <label className="label" htmlFor="q">
          Search
        </label>
        <input
          className="input"
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Company name — press Enter"
        />
      </form>

      <div className="field" style={{ margin: 0 }}>
        <label className="label" htmlFor="status">
          Status
        </label>
        <select
          className="input"
          id="status"
          value={status}
          onChange={(e) => navigate(q, e.target.value)}
        >
          <option value="">All statuses</option>
          {CARRIER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {(q || status) && (
        <button
          type="button"
          className="btn"
          onClick={() => navigate("", "")}
          style={{ alignSelf: "flex-end" }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
