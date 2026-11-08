import { whatIfsOf } from "../lib/run-settings.js";
import type { Run } from "../store/season.js";
import { PEAK_LABEL } from "./DriverAbilitySetting.js";
import { randomnessLabel } from "./RandomnessSlider.js";

/**
 * The bug report: a Google Form, the author's, opened with the run already
 * written into it.
 *
 * A form rather than a GitHub issue because the repository is private and most
 * players have no GitHub account; the app itself still sends nothing; the
 * player does, by submitting. Google Forms has no hidden fields, so the run
 * arrives as an answer the player can see and edit.
 */
const FORM =
  "https://docs.google.com/forms/d/e/1FAIpQLSeU80mqeP-uuDZRNfn9F1lcVG14DMGX9Uxhx-F13bwIgQUyhw/viewform";

/** The form's "Seed, season, mode, settings" question, as its pre-filled link names it. */
const RUN_FIELD = "entry.1105900486";

/**
 * The run in one line: enough to replay it. The seed, year and, in an era, the
 * year and seed it started on; the ability and the luck always, since a report
 * cannot lean on the reader knowing the defaults; then every setting off real
 * history.
 */
export function runDetails(run: Run): string {
  const { world } = run;
  const era =
    run.kind === "era"
      ? [`era from ${run.run.startYear}, first seed ${run.run.seasons[0]?.seed ?? world.seed}`]
      : [];
  const settings = [
    { name: "Driver ability", value: world.ratingMode === "peak" ? PEAK_LABEL : "As they were" },
    {
      name: "Luck on the day",
      value: `${randomnessLabel(world.randomness)} (${world.randomness})`,
    },
    ...whatIfsOf(world.settings),
  ];
  return [
    `Seed ${world.seed}`,
    `season ${world.year}`,
    ...era,
    ...settings.map(({ name, value }) => `${name}: ${value}`),
  ].join(" · ");
}

/** The form's address, with the run written in when there is one. */
export function bugReportUrl(run: Run | null): string {
  if (run === null) return FORM;
  const query = new URLSearchParams({ usp: "pp_url", [RUN_FIELD]: runDetails(run) });
  return `${FORM}?${query.toString()}`;
}
