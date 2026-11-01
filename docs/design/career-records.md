# Historical career records

A run starting in 1980 opens with Jones's wins and Ferrari's titles already counted, and the
simulated results add onto them. Each season file carries, per driver and per team, the
**championships, wins, podiums and poles accumulated before that season**.

- DECIDED: **an opening balance, not a running counter.** Nothing before the start year has
  results to derive from, so the balance is authored; a display total is the balance plus
  what is derived from result rows. Never write simulated results back into it.
- DECIDED: it covers people not on that season's grid (replacements, one-offs, drivers
  between seats), keyed by driver and team id over everyone the era might surface.
- DECIDED: only the start year's balance is read in a run. Authoring all seasons is what
  lets any year be a start year.
- DECIDED: team totals follow team lineage (`team-eras.md`), or a rebadged team's roll-up
  lies.
- Read by the era's champions screen, and later the driver market (reputations).
- OPEN: do the era's share cards count titles from before the start year, or only the
  run's? Until this is built, only the run's.
