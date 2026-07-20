"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { approveRequest, rejectRequest } from "@/lib/actions/approvals";
import type { FormState } from "@/lib/actions/_util";

export function ApprovalActions({ requestId }: { requestId: number }) {
  const [aState, approve] = useActionState<FormState, FormData>(approveRequest, {});
  const [rState, reject] = useActionState<FormState, FormData>(rejectRequest, {});
  const router = useRouter();

  useEffect(() => {
    if (aState.ok || rState.ok) router.refresh();
  }, [aState.ok, rState.ok, router]);

  return (
    <div className="pill-row" style={{ justifyContent: "flex-end" }}>
      <form action={approve} style={{ display: "inline" }}>
        <input type="hidden" name="request_id" value={requestId} />
        <button className="btn btn-primary btn-sm" type="submit">Approve</button>
      </form>
      <form action={reject} style={{ display: "inline" }}>
        <input type="hidden" name="request_id" value={requestId} />
        <button className="btn btn-sm btn-danger" type="submit">Reject</button>
      </form>
      {(aState.error || rState.error) ? (
        <span className="error-box" style={{ margin: 0 }}>
          {aState.error || rState.error}
        </span>
      ) : null}
    </div>
  );
}
