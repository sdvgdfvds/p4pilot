import { useState } from "react";
import type { ChangelistSummary } from "@p4pilot/core/browser";

export function ChangelistList({ changelists, onCreate }: {
  changelists: ChangelistSummary[];
  onCreate: (description: string) => void;
}) {
  const [desc, setDesc] = useState("");
  return (
    <section>
      <h3>Pending changelists</h3>
      <ul>
        {changelists.map((cl) => (
          <li key={cl.change}>{cl.change} — {cl.description}</li>
        ))}
      </ul>
      <input aria-label="new changelist" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <button onClick={() => { if (desc.trim()) { onCreate(desc.trim()); setDesc(""); } }}>Create CL</button>
    </section>
  );
}
