import type { CalendarRace } from "@alt-hist/data";
import type { PointsScale, SeasonResult } from "@alt-hist/engine";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from "recharts";
import { niceTicks, phoneRoundTick, spreadLabels } from "../lib/chart-layout.js";
import {
  driversEvolution,
  type EvolutionSeries,
  evolutionRows,
  teamsEvolution,
} from "../lib/evolution.js";
import { legible } from "../lib/livery.js";
import { driverName } from "../lib/names.js";
import { cn } from "../lib/utils.js";
import { DriverName } from "./DriverName.js";
import { useEntryName } from "./EntryNames.js";
import { useLivery } from "./Liveries.js";
import { TeamName } from "./TeamName.js";
import { Card, CardBand } from "./ui/card.js";

/**
 * The championship as a line per competitor, round by round.
 *
 * The tables below say who won; this says *when* — the run of form that turned
 * the season, the round a lead stopped being catchable, the two cars that
 * swapped places all year. It sits between the calendar and the tables for that
 * reason: the calendar is what happened, this is how it added up, the tables are
 * where it ended.
 *
 * **The y axis is points, not position.** Position is the flatter, tidier chart
 * and throws away the only thing worth seeing — a title decided by two points
 * and one decided by forty look identical on it.
 *
 * ## Why the colours travel as custom properties
 *
 * Series colours are the teams' own, through `legible()` in `lib/livery.ts` —
 * the one anti-clash mechanism this app has, and a chart drawing raw authored
 * colours would lose the white and near-black teams exactly as the team cards
 * did. But `legible()` returns a `color-mix(…, var(--color-foreground))`, and
 * **`var()` does not work in an SVG presentation attribute**: `stroke="var(…)"`
 * is ignored, and an ignored stroke is an invisible line. So each series colour
 * is set as a custom property on the card, and the stroke is applied by a CSS
 * rule instead — a real declaration, where both `color-mix` and `var` are the
 * same baseline the rest of the app already relies on.
 *
 * That is why `SERIES_STROKE` is a list of literal class strings rather than
 * anything built at runtime: Tailwind generates a class only if it can see it
 * spelled out in the source.
 *
 * ## Why there is almost nothing to test here
 *
 * **Recharts renders nothing without a DOM** — a static render of this card
 * produces its heading, its legend and an empty container, and that is not a
 * quirk of `ResponsiveContainer`: a fixed-size `LineChart` renders an empty
 * wrapper too. Everything that could be wrong about the *data* therefore lives
 * in `lib/evolution.ts`, which is tested properly, and the legend below is
 * plain HTML so that the names, the order and the totals are still assertable.
 */

/**
 * Where each line's colour comes from — one class per slot, matching the
 * `--series-N` properties set on the card.
 *
 * The stroke has to be aimed at the path rather than at the group Recharts puts
 * the class on: the path carries its own `stroke` presentation attribute, which
 * beats a colour inherited from an ancestor but loses to any rule that selects
 * the path itself.
 */
const SERIES_STROKE = [
  "[&_.recharts-curve]:[stroke:var(--series-0)]",
  "[&_.recharts-curve]:[stroke:var(--series-1)]",
  "[&_.recharts-curve]:[stroke:var(--series-2)]",
  "[&_.recharts-curve]:[stroke:var(--series-3)]",
  "[&_.recharts-curve]:[stroke:var(--series-4)]",
  "[&_.recharts-curve]:[stroke:var(--series-5)]",
];

/**
 * The dashes a team's cars take, in order: the first solid, then the rest.
 *
 * Team-mates in the top six is the ordinary case rather than an edge one — 1950
 * puts three Alfas in the first three places, and drawn plainly they would be
 * one line traced over three times. They are **never recoloured** to separate
 * them: colour follows the team, and a driver in a different red from his own
 * car is a worse lie than a line that needs a second look.
 *
 * Four patterns because three cars in a team has happened and a fourth is not
 * worth guarding against; past the end the last one repeats, and the number at
 * the end of each line is what settles it either way.
 */
const TEAM_DASHES = ["", "5 4", "1 4", "9 3 1 3"];

/**
 * How tall a plot is.
 *
 * Six lines through twenty-four rounds need the room: at 260 the middle of the
 * field ran together in a band a few pixels deep, and where two cars actually
 * changed places was a guess. Tall enough to read the order off, short enough
 * that the table it belongs to is still on screen above it.
 */
const CHART_HEIGHT = 325;

type Championship = "drivers" | "constructors";

/**
 * A line's competitor, named as every table names them: flag beside it, a
 * driver's name alone (no team line) and a team as it raced the season.
 * `id` is the series key, a driver id or a team id by the table.
 */
function LineName({ championship, id }: { championship: Championship; id: string }) {
  return championship === "drivers" ? <DriverName driverId={id} /> : <TeamName teamId={id} />;
}

/** A line, ready to draw: the fold's series plus what this screen calls it. */
interface Plotted {
  readonly series: EvolutionSeries;
  readonly name: string;
  /** The team's own colour, already made safe against either theme. */
  readonly colour: string;
  /**
   * The SVG dash pattern, empty for a solid line — set only where a line above
   * it already wears these colours.
   */
  readonly dash: string;
}

/**
 * A colour per series, with a team's later cars dashed rather than recoloured.
 *
 * Colour follows the entity, never its position — a driver does not change
 * colour for finishing second, and both Williams are drawn in Williams' colours.
 */
function plot(
  series: readonly EvolutionSeries[],
  nameOf: (key: string) => string,
  colourOf: (teamId: string) => string | undefined,
): Plotted[] {
  const drawn = new Map<string, number>();
  return series.map((line) => {
    const nth = drawn.get(line.teamId) ?? 0;
    drawn.set(line.teamId, nth + 1);
    return {
      series: line,
      name: nameOf(line.key),
      // A team the seed data does not know draws in the plain foreground rather
      // than not at all — the same "quieter than a wrong one" choice the badge
      // makes, except that a missing line would silently drop a competitor.
      colour: colourOf(line.teamId) ?? "var(--color-foreground)",
      dash: TEAM_DASHES[Math.min(nth, TEAM_DASHES.length - 1)] ?? "",
    };
  });
}

/**
 * A dash pattern, as a CSS gradient — the same numbers the line is drawn with.
 *
 * The legend's mark has to wear the *same* pattern the line does, or it stops
 * being how two Alfas are told apart. Deriving it from `TEAM_DASHES` rather
 * than writing each one twice is what keeps the two from drifting: the numbers
 * are SVG dash lengths, alternating drawn and blank, and repeating.
 *
 * A `<span>` and not an inline SVG, for the reason `TeamBadge` is one — several
 * tests count the flags in a table by counting `<svg>`.
 */
export function dashGradient(colour: string, dash: string): string {
  if (dash === "") {
    return colour;
  }
  const lengths = dash.split(" ").map(Number);
  // An odd-length pattern alternates on the second pass through — "1 4 2" is
  // drawn, blank, drawn, blank, drawn, blank with lengths 1,4,2,1,4,2 — so the
  // gradient has to repeat it twice to cover a whole cycle.
  const cycle = lengths.length % 2 === 0 ? lengths : [...lengths, ...lengths];
  let at = 0;
  const stops = cycle.map((length, index) => {
    const from = at;
    at += length;
    return `${index % 2 === 0 ? colour : "transparent"} ${from}px ${at}px`;
  });
  return `repeating-linear-gradient(to right, ${stops.join(", ")})`;
}

/** The mark beside a name in the legend and the tooltip: the line, in miniature. */
function Swatch({ colour, dash }: { colour: string; dash: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-0.5 w-5 shrink-0"
      style={{ background: dashGradient(colour, dash) }}
    />
  );
}

/**
 * What the reader gets on hover: the round, named, and every line's total.
 *
 * Ordered by points at that moment rather than by the final table, because the
 * question a hover asks is "who was leading here".
 */
function EvolutionTooltip({
  active,
  label,
  lines,
  calendar,
  championship,
}: {
  /** Both come off Recharts' own `TooltipContentProps`, and both can be absent. */
  active?: boolean | undefined;
  label?: string | number | undefined;
  lines: readonly Plotted[];
  calendar: readonly CalendarRace[];
  championship: Championship;
}) {
  if (active !== true || typeof label !== "number") {
    return null;
  }
  const round = label;
  const race = calendar[round - 1];
  const standing = lines
    .map((line) => ({ line, points: line.series.points[round - 1] ?? 0 }))
    .sort((a, b) => b.points - a.points);
  return (
    <div className="bg-card border-border rounded-lg border px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground pb-1">
        Round {round}
        {race === undefined ? "" : ` — ${race.name}`}
      </p>
      {standing.map(({ line, points }) => (
        <p key={line.series.key} className="flex items-center gap-2 py-0.5">
          <Swatch colour={line.colour} dash={line.dash} />
          <span className="grow">
            <LineName championship={championship} id={line.series.key} />
          </span>
          <span className="tabular-nums">{points}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * How much room the end-of-line numbers need, to the right of the plot.
 *
 * Two digits and a gap, and this and the label's own offset are one measurement
 * in two places. Padding beside the chart rather than its margin, since only CSS
 * knows the width: a phone hides the numbers, and the plot takes the room back.
 * The chart's surface is left unclipped, so the numbers draw into it.
 */
const END_LABEL_ROOM = 22;

/**
 * How far apart two end-of-line numbers have to sit to be read as two numbers: a
 * label's height. Lines that finish level, or a point apart, would otherwise print
 * one on top of the other.
 */
const END_LABEL_STEP = 11;

/**
 * How many gaps the y axis aims for, at most. Five over a plot this tall puts a
 * rule about every sixty pixels; `niceTicks` then rounds the step up.
 */
const Y_TICK_INTERVALS = 5;

/**
 * How many names a legend puts across a row on a full-width window.
 *
 * Three, which is the six-driver case and the one that was wrapping badly. The
 * exception is a count that would leave a single name alone on the last row —
 * four teams read better as two rows of two than as three and a straggler.
 * Narrower windows always take two; one across is the phone layout's problem,
 * not this rule's.
 */
export function legendColumns(count: number): number {
  return count % 3 === 1 && count > 1 ? 2 : 3;
}

/**
 * Every line's number from the legend, drawn once each, at the end of its line.
 *
 * One component for all the lines rather than a `LabelList` per line, because
 * only the whole set can be kept apart: a label knows where its own line ends and
 * nothing about the others. So this reads the chart's own scales (it must sit
 * inside the chart), asks `spreadLabels` where the numbers go, and draws them.
 * It wears the muted text token rather than the series colour: text stays ink, and
 * the mark beside it carries identity.
 */
function EndLabels({
  finals,
  round,
}: {
  /** Each line in position order, with the total it ends on. */
  finals: readonly { key: string; points: number }[];
  /** The last round, where the lines end. */
  round: number;
}) {
  const area = usePlotArea();
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const x = xScale?.(round, { position: "middle" });
  const wanted = finals.map(({ points }) => yScale?.(points) ?? Number.NaN);
  if (area === undefined || x === undefined || wanted.some(Number.isNaN)) {
    return null;
  }
  const placed = spreadLabels(wanted, {
    top: area.y,
    bottom: area.y + area.height,
    gap: END_LABEL_STEP,
  });
  // Not on a phone: a plot that narrow bunches the lines, so the numbers pile
  // up at their ends, and the legend under it names every line anyway.
  return (
    <g className="max-sm:hidden">
      {placed.map((y, index) => (
        <text
          key={finals[index]?.key}
          x={x + 6}
          y={y}
          dominantBaseline="middle"
          fontSize={11}
          className="fill-muted-foreground font-mono"
        >
          {index + 1}
        </text>
      ))}
    </g>
  );
}

/**
 * A round's number under the chart. A phone hides all but `phoneRoundTick`'s by
 * a media query, the way every phone layout here is chosen (`docs/design/publish.md`).
 */
function RoundTick({
  x,
  y,
  payload,
}: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: number };
}) {
  const round = payload?.value ?? 0;
  return (
    <text
      x={x}
      y={y}
      dy="0.71em"
      textAnchor="middle"
      fill="currentColor"
      fontSize={11}
      className={phoneRoundTick(round) ? undefined : "max-sm:hidden"}
    >
      {round}
    </text>
  );
}

/**
 * One chart, with its legend under it.
 *
 * The legend is below rather than beside so that a narrow window costs the
 * chart nothing, and it is ordinary HTML rather than Recharts' own for the same
 * reason it carries the final totals: it is the half of this card a reader on a
 * phone, a screen reader, or a test can actually read.
 */
function EvolutionChart({
  title,
  label,
  lines,
  calendar,
  championship,
}: {
  title: string;
  label: string;
  lines: readonly Plotted[];
  calendar: readonly CalendarRace[];
  championship: Championship;
}) {
  const rows = useMemo(() => evolutionRows(lines.map((line) => line.series)), [lines]);
  const finals = useMemo(
    () => lines.map((line) => ({ key: line.series.key, points: line.series.points.at(-1) ?? 0 })),
    [lines],
  );
  // The axis tops out on a round number above the highest total any line reaches.
  const ticks = useMemo(
    () => niceTicks(Math.max(0, ...lines.flatMap((line) => line.series.points)), Y_TICK_INTERVALS),
    [lines],
  );
  const colours = Object.fromEntries(
    lines.map((line, index) => [`--series-${index}`, line.colour]),
  ) as React.CSSProperties;

  return (
    <Card>
      <CardBand title={title} label={label} />
      <div className="px-2 py-4 text-xs" style={colours}>
        <div
          className="[&_.recharts-surface]:overflow-visible sm:pr-(--end-label-room)"
          style={{ "--end-label-room": `${END_LABEL_ROOM}px` } as React.CSSProperties}
        >
          <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
            <LineChart
              data={rows}
              margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              {/* Horizontal only: the rounds are already marked by the axis, and a
                second set of rules through the lines is noise. */}
              <CartesianGrid vertical={false} stroke="currentColor" className="text-border" />
              <XAxis
                dataKey="round"
                stroke="currentColor"
                className="text-muted-foreground font-mono"
                // Every round, so which are numbered is a CSS rule rather than
                // Recharts' own thinning, which moves with the width.
                interval={0}
                tick={RoundTick}
                tickLine={false}
                axisLine={false}
                padding={{ left: 4, right: 4 }}
              />
              <YAxis
                stroke="currentColor"
                className="text-muted-foreground font-mono"
                tick={{ fill: "currentColor", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, ticks.at(-1) ?? 1]}
                ticks={ticks}
                width={32}
              />
              <Tooltip
                cursor={{ stroke: "currentColor", strokeOpacity: 0.35 }}
                content={(props) => (
                  <EvolutionTooltip
                    active={props.active}
                    label={props.label}
                    lines={lines}
                    calendar={calendar}
                    championship={championship}
                  />
                )}
              />
              {lines.map((line, index) => (
                <Line
                  key={line.series.key}
                  dataKey={line.series.key}
                  // Straight between rounds. A smoothed curve would draw points
                  // nobody scored, in the gaps where nothing happened.
                  type="linear"
                  className={SERIES_STROKE[index] ?? ""}
                  strokeWidth={2}
                  {...(line.dash === "" ? {} : { strokeDasharray: line.dash })}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive={false}
                />
              ))}
              {/* The number the legend gives each line, at the end of it. Six lines
                in four shades of one red is what 1950 actually looks like, and
                colour alone cannot carry six identities. */}
              <EndLabels finals={finals} round={rows.at(-1)?.round ?? 0} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/*
          A grid rather than a wrapping row: six names of unequal length wrapped
          five-and-one, which reads as a mistake. Fixed columns also line the
          names up under each other, so the legend can be read down as a table.
        */}
        <ul
          className={cn(
            // One name a row on a phone, where two columns wrapped every name.
            "grid grid-cols-1 gap-x-4 gap-y-1 px-3 pt-3 sm:grid-cols-2",
            legendColumns(lines.length) === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3",
          )}
        >
          {lines.map((line, index) => (
            <li key={line.series.key} className="flex items-center gap-2">
              <Swatch colour={line.colour} dash={line.dash} />
              <span className="text-muted-foreground tabular-nums">{index + 1}</span>
              <LineName championship={championship} id={line.series.key} />
              <span className="tabular-nums">{line.series.points.at(-1) ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

/**
 * One championship as it developed: the top six drivers, or the top four teams.
 *
 * Drawn **directly under the table it explains**, rather than as a pair
 * somewhere else on the page: the table says who won and the chart under it says
 * when, and a reader should not have to hold six names in their head between
 * the two. `SeasonStandings` is what puts them in that order.
 *
 * Nothing is stored for this — the standings are derived from the result rows,
 * so the season up to round n is the same season sliced shorter. A season of
 * one round is not drawn: two points make a line, one makes a dot.
 */
export function StandingsEvolution({
  championship,
  season,
  points,
  calendar,
  finished,
}: {
  /** Which table this chart belongs under. */
  championship: "drivers" | "constructors";
  season: SeasonResult;
  points: PointsScale;
  calendar: readonly CalendarRace[];
  /** The season is over. Until then nobody has won, so the heading says how it stands. */
  finished: boolean;
}) {
  const nameOf = useEntryName();
  const liveryOf = useLivery();
  const colourOf = (teamId: string) => {
    const livery = liveryOf(teamId);
    return livery === undefined ? undefined : legible(livery.primaryColor);
  };

  const drivers = useMemo(() => driversEvolution(season, points), [season, points]);
  const teams = useMemo(() => teamsEvolution(season, points), [season, points]);

  if (season.races.length < 2) {
    return null;
  }

  return championship === "drivers" ? (
    <EvolutionChart
      title={`How the drivers’ title ${finished ? "was won" : "race stands"}`}
      label="Points after every round"
      lines={plot(drivers, driverName, colourOf)}
      calendar={calendar}
      championship={championship}
    />
  ) : (
    <EvolutionChart
      title={`How the constructors’ title ${finished ? "was won" : "race stands"}`}
      label="Points after every round"
      lines={plot(teams, nameOf, colourOf)}
      calendar={calendar}
      championship={championship}
    />
  );
}

/** Only for the tests, which cannot reach the chart itself. */
export { type Plotted, plot as plotSeries };
