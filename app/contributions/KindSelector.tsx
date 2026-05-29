"use client";

import { useTransition } from "react";
import { updateContributionKind } from "./actions";

type Props = {
  contributionId: string;
  kind: "contribution" | "withdrawal" | undefined;
};

export function KindSelector({ contributionId, kind }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newKind = e.target.value as "contribution" | "withdrawal";
    startTransition(() => {
      updateContributionKind(contributionId, newKind);
    });
  }

  return (
    <select
      className="kind-selector"
      value={kind === "withdrawal" ? "withdrawal" : "contribution"}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Withdrawal type"
    >
      <option value="contribution">From Principal</option>
      <option value="withdrawal">From Gains</option>
    </select>
  );
}
