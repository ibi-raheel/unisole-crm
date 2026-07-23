"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CARRIER_STATUSES } from "@/lib/status";

type Opt = { id: number; label: string };

// Search + status (+ optional dispatcher) filter for the carriers list.
export function CarrierFilters({ dispatchers }: { dispatchers?: Opt[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const dispatcher = sp.get("dispatcher") ?? "";

  function navigate(nextQ: string, nextStatus: string, nextDispatcher: string) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextStatus) params.set("status", nextStatus);
    if (nextDispatcher) params.set("dispatcher", nextDispatcher);
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
          const input = e.currentTarget.elements.namedItem("q") as HTMLInputElement;
          navigate(input.value, status, dispatcher);
        }}
      >
        <label className="label" htmlFor="q">Search</label>
        <input
          className="input"
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Company name — press Enter"
        />
      </form>

      <div className="field" style={{ margin: 0 }}>
        <label className="label" htmlFor="status">Status</label>
        <select
          className="input"
          id="status"
          value={status}
          onChange={(e) => navigate(q, e.target.value, dispatcher)}
        >
          <option value="">All statuses</option>
          {CARRIER_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {dispatchers && dispatchers.length > 0 && (
        <div className="field" style={{ margin: 0 }}>
          <label className="label" htmlFor="dispatcher">Dispatcher</label>
          <select
            className="input"
            id="dispatcher"
            value={dispatcher}
            onChange={(e) => navigate(q, status, e.target.value)}
          >
            <option value="">All dispatchers</option>
            <option value="none">— Unassigned —</option>
            {dispatchers.map((d) => (
              <option key={d.id} value={String(d.id)}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {(q || status || dispatcher) && (
        <button
          type="button"
          className="btn"
          onClick={() => navigate("", "", "")}
          style={{ alignSelf: "flex-end" }}
        >
          Clear
        </button>
      )}
    </div>
  );
}
