# Triage Labels

The skills speak in terms of seven canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Canonical role    | Label in our tracker | Color     | Meaning                                  |
| ----------------- | -------------------- | --------- | ---------------------------------------- |
| `needs-triage`    | `needs-triage`       | default   | Maintainer needs to evaluate this issue  |
| `needs-info`      | `needs-info`         | default   | Waiting on reporter for more information |
| `ready-for-agent` | `ready-for-agent`    | default   | Fully specified, ready for an AFK agent  |
| `agent-working`   | `agent-working`      | default   | An agent has picked this up and is actively working it |
| `agent-done`      | `agent-done`         | `#1383ad` | Agent finished; change is included in the next PR |
| `ready-for-human` | `ready-for-human`    | default   | Requires human implementation            |
| `wontfix`         | `wontfix`            | default   | Will not be actioned                     |

The `wontfix` label already exists in this repo (GitHub stock label) — reuse it as-is. The other six get created on first use.

When creating labels in GitHub, pass the color without the `#`, e.g. `gh label create agent-done --color 1383ad`. "default" means accept whatever color the tracker assigns.

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.
