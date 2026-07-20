import { useState } from "react";
import type { ChangelistSummary } from "@p4pilot/core/browser";
import { ClipboardList, LoaderCircle, Plus } from "lucide-react";

export function ChangelistList({
  changelists,
  creating,
  onCreate,
}: {
  changelists: ChangelistSummary[];
  creating: boolean;
  onCreate: (description: string) => Promise<boolean>;
}) {
  const [desc, setDesc] = useState("");
  return (
    <section className="changelists" aria-labelledby="changelists-heading">
      <div className="panel-heading">
        <span className="panel-icon" aria-hidden="true">
          <ClipboardList size={17} />
        </span>
        <div>
          <h3 id="changelists-heading">Pending changelists</h3>
          <p>{changelists.length} active</p>
        </div>
      </div>
      <ul className="changelist-list">
        {changelists.map((cl) => (
          <li key={cl.change}>
            <span className="cl-number">CL {cl.change}</span>
            <span>{cl.description}</span>
          </li>
        ))}
      </ul>
      <form
        className="create-changelist"
        onSubmit={(event) => {
          event.preventDefault();
          const description = desc.trim();
          if (description)
            void onCreate(description).then(
              (created) => created && setDesc(""),
            );
        }}
      >
        <label htmlFor="new-changelist">New changelist</label>
        <input
          id="new-changelist"
          aria-label="new changelist"
          placeholder="Describe the intended change"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          disabled={creating}
        />
        <button
          className="command-button"
          type="submit"
          disabled={creating || !desc.trim()}
        >
          {creating ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          {creating ? "Creating…" : "Create CL"}
        </button>
      </form>
    </section>
  );
}
