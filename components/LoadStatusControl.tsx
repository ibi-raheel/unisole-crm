"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLoadStatus } from "@/lib/actions/loads";
import type { FormState } from "@/lib/actions/_util";

// Inline control on the carrier page to mark a load Delivered / update payment.
export function LoadStatusControl({
  loadId,
  carrierId,
  loadStatus,
  paymentStatus,
}: {
  loadId: number;
  carrierId: number;
  loadStatus: string;
  paymentStatus: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(
    setLoadStatus,
    {}
  );
  const router = useRouter();

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="pill-row">
      <input type="hidden" name="load_id" value={loadId} />
      <input type="hidden" name="carrier_id" value={carrierId} />
      <select className="input" name="load_status" defaultValue={loadStatus} style={{ width: 120 }}>
        <option value="En Route">En Route</option>
        <option value="Delivered">Delivered</option>
      </select>
      <select className="input" name="payment_status" defaultValue={paymentStatus} style={{ width: 150 }}>
        <option value="Pending">Pending</option>
        <option value="Invoice Created">Invoice Created</option>
        <option value="Paid">Paid</option>
      </select>
      <button type="submit" className="btn" style={{ padding: "4px 8px" }}>
        Save
      </button>
      {state.error ? (
        <span className="error-box" style={{ margin: 0 }}>
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
