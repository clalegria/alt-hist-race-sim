import { Fragment, useMemo, useState } from "react";
import { teamName } from "../lib/names.js";
import {
  type CareerRecord,
  careerRecords,
  labelsFor,
  type RankedRecord,
  type RecordLabel,
  type RecordMetric,
  rankBy,
  spellSpan,
  spellsBy,
} from "../lib/records.js";
import type { World } from "../store/season.js";
import { DisclosureButton } from "./DisclosureButton.js";
import { DriverName } from "./DriverName.js";
import { useTeamNameIn } from "./EntryNames.js";
import { Liveries } from "./Liveries.js";
import { DriverHistory, TeamHistory } from "./SeasonHistory.js";
import { ShowAllButton } from "./ShowAllButton.js";
import { TeamName } from "./TeamName.js";
import { Card, CardBand } from "./ui/card.js";
import { Table, TableBody, TableCell, TablePosition, TableRow } from "./ui/table.js";

/**
 * How many careers a record card shows before it is opened out.
 *
 * Ten, because a record book's unit is the top ten — and because four cards of
 * it is already a screen. Everyone with at least one of the thing counted is
 * behind the button, however long an era runs.
 */
const COLLAPSED_ROWS = 10;

/** The four cards each half of the statistics is made of, in the order drawn. */
const CARDS: readonly { readonly metric: RecordMetric; readonly title: string }[] = [
  { metric: "titles", title: "Championships" },
  { metric: "wins", title: "Race wins" },
  { metric: "podiums", title: "Podiums" },
  { metric: "poles", title: "Pole positions" },
];

/** Which list a card is of. Teams have spells to open; drivers never do. */
type RecordKind = "driver" | "team";

/**
 * One name a lineage's figure was won under: "as Leyton House (1990–1991)".
 *
 * Unbadged and unflagged, which is the rule for anything that only appears
 * after a click — an expansion repeating the row above it is noise rather than
 * detail. The name is plain text for the same reason `TeamName` cannot be used
 * here at all: this row is about the name the team *had*, not about the team as
 * it is labelled today, and those are two different strings.
 */
function SpellRow({ name, span, value }: { name: string; span: string; value: number }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell className="py-1" />
      <TableCell className="text-muted-foreground w-full max-w-0 truncate py-1 pl-6 text-xs">
        as {name} <span className="tabular-nums">({span})</span>
      </TableCell>
      <TableCell className="text-muted-foreground w-10 py-1 text-right text-xs tabular-nums">
        {value}
      </TableCell>
    </TableRow>
  );
}

/**
 * The career panel behind a row's name — the driver's or the team's.
 *
 * A switch rather than two branches at the call site, because everything either
 * side of it is identical: the card draws one kind or the other and the row is
 * otherwise the same markup.
 */
function Career({
  kind,
  id,
  className,
  children,
}: {
  kind: RecordKind;
  id: string;
  className?: string;
  children: React.ReactNode;
}) {
  return kind === "driver" ? (
    <DriverHistory driverId={id} className={className}>
      {children}
    </DriverHistory>
  ) : (
    <TeamHistory teamId={id} className={className}>
      {children}
    </TeamHistory>
  );
}

/**
 * One career, as a record card writes it: position, name, figure.
 *
 * **A driver is named alone** — no team, no badge. A career total is the whole
 * of a driver's era and most of them drove for several teams in it, so labelling
 * the row with the last one would attribute a decade of somebody else's cars to
 * whoever happened to be running them at the end.
 *
 * **A team is named by its most successful spell** — `label`, the same on
 * every card (`labelsFor`). Its name and its livery are eras, so a row spanning
 * 1980 to 1994 has to be drawn as of *some* year, and the label's year decides
 * both. That is a `Liveries` provider per row, the same trick the roll of
 * honour uses to give each year its own colours; a provider renders no DOM, so
 * it nests inside `<tbody>` fine. Without a label the row is drawn as of the
 * last season it appears in. There is deliberately **no `EntryNames`**:
 * "Williams-Ford" names an entry and an entry is a season, so a career shows
 * the plain team name.
 *
 * A lineage that scored under more than one name **opens into its spells**, and
 * says so twice over: the chevron the rest of the app uses for a row that
 * opens, and a muted line under the name counting them. Without the count the
 * chevron does not say what is behind it, and "Mercedes, 100 wins" quietly
 * claims a Tyrrell decade for a name that did not exist for it.
 *
 * **Controlled**, like `ChampionRow` and the grid editor's tables, so both
 * states render without a DOM and without a click.
 */
export function RecordRow({
  ranked,
  kind,
  metric,
  label,
  open,
  onToggle,
}: {
  ranked: RankedRecord;
  kind: RecordKind;
  metric: RecordMetric;
  /** How the cards name this lineage. Teams only; see `labelsFor`. */
  label?: RecordLabel | undefined;
  open: boolean;
  onToggle: () => void;
}) {
  const { record, value, position, shared } = ranked;
  const spells = kind === "team" ? spellsBy(record, metric) : [];
  const many = spells.length > 1;
  const leader = position === 1;
  // The year the row is drawn as of decides both the name and the livery, so
  // setting it is the whole of "name it by its most successful spell":
  // `TeamName` resolves the same name off the same year rather than being
  // handed a string.
  const year = label?.year ?? record.lastYear;
  const name =
    kind === "driver" ? (
      <DriverName driverId={record.id} emphasis={leader} tight />
    ) : (
      <span className="flex min-w-0 items-center gap-1.5">
        <TeamName teamId={record.id} emphasis={leader} badge tight />
        {label?.span == null ? null : (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            ({label.span})
          </span>
        )}
      </span>
    );

  return (
    <Liveries year={year}>
      <TableRow>
        <TablePosition className="py-1.5">
          {shared ? "=" : ""}
          {position}
        </TablePosition>
        {/*
          `w-full max-w-0` for the reason the provisional standings use it: the
          cell takes the slack the two number columns leave without letting the
          name inside size the column, so a long entry truncates instead of
          pushing a scrollbar under a card that is half a page wide.
        */}
        <TableCell className="w-full max-w-0 py-1.5">
          {/*
            Two controls on a lineage row, and only because a name cannot be
            both a button and the trigger of another one: the **chevron** keeps
            the breakdown by name, the **name** opens the career panel. The
            file-tree split, and the only arrangement that keeps the expansion
            this table already had once the name started opening a panel of its
            own. Rows that do not expand keep the single control the rest of the
            app has, so the second tab stop is paid for only where it buys
            something.
          */}
          <span className="flex min-w-0 items-center gap-1">
            {many ? (
              <DisclosureButton
                open={open}
                onToggle={onToggle}
                label={`Names ${label?.name ?? teamName(record.id, year)} scored under`}
              />
            ) : null}
            <Career kind={kind} id={record.id} className="min-w-0 flex-1">
              <span className="flex min-w-0 flex-col leading-tight">
                {name}
                {many ? (
                  <span className="text-muted-foreground text-xs">under {spells.length} names</span>
                ) : null}
              </span>
            </Career>
          </span>
        </TableCell>
        <TableCell className="w-10 py-1.5 text-right font-semibold tabular-nums">{value}</TableCell>
      </TableRow>
      {many && open
        ? spells.map((spell) => (
            <SpellRow
              key={`${spell.name}-${spell.firstYear}`}
              name={spell.name}
              span={spellSpan(spell)}
              value={spell[metric]}
            />
          ))
        : null}
    </Liveries>
  );
}

/**
 * One statistic, best first — the ten leading careers, and the rest a click away.
 *
 * Carries **no champion's accent**. The rule is one accented row per view and
 * this screen already spends it on the season just finished; eight cards each
 * highlighting their own leader would turn an accent that means "the thing you
 * just watched" into ordinary decoration. First place is set in bold instead.
 *
 * Which rows are open is this card's own business, so unlike the roll of honour
 * it keeps that state itself — and **more than one may be open**, because a
 * spell list is three or four short rows rather than two championship tables.
 */
export function RecordCard({
  title,
  records,
  metric,
  kind,
}: {
  title: string;
  /** Every career of one list — the card ranks and cuts it itself. */
  records: readonly CareerRecord[];
  metric: RecordMetric;
  kind: RecordKind;
}) {
  const [expanded, setExpanded] = useState(false);
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const ranked = useMemo(() => rankBy(records, metric), [records, metric]);
  const teamNameIn = useTeamNameIn();
  // Off the whole list rather than this card's rows, so every card of the
  // section names a lineage the same way. Drivers are never labelled this way:
  // two of them sharing a name is a coincidence, not two eras of one
  // organisation, and neither of them is "the 1954-55 one".
  const labels = useMemo(
    () => (kind === "team" ? labelsFor(records, teamNameIn) : null),
    [records, kind, teamNameIn],
  );
  const canExpand = ranked.length > COLLAPSED_ROWS;
  const rows = expanded || !canExpand ? ranked : ranked.slice(0, COLLAPSED_ROWS);

  return (
    <Card>
      <CardBand title={title} as="h3" />
      {rows.length === 0 ? (
        // An era one season long has champions and winners but can still have a
        // card nobody is on — a blank panel reads as a bug, so it says so.
        <p className="text-muted-foreground px-3 py-3 text-sm">Nobody has one yet.</p>
      ) : (
        <Table>
          <TableBody>
            {rows.map((row) => (
              <Fragment key={row.record.id}>
                <RecordRow
                  ranked={row}
                  kind={kind}
                  metric={metric}
                  label={labels?.get(row.record.id)}
                  open={openIds.has(row.record.id)}
                  onToggle={() => {
                    const next = new Set(openIds);
                    if (!next.delete(row.record.id)) {
                      next.add(row.record.id);
                    }
                    setOpenIds(next);
                  }}
                />
              </Fragment>
            ))}
          </TableBody>
        </Table>
      )}
      {canExpand ? (
        <ShowAllButton
          expanded={expanded}
          onToggle={() => {
            setExpanded(!expanded);
          }}
          total={ranked.length}
          collapsed={COLLAPSED_ROWS}
        />
      ) : null}
    </Card>
  );
}

/** Four cards over one list of careers — the drivers' half, or the teams'. */
function RecordSection({
  heading,
  records,
  kind,
}: {
  heading: string;
  records: readonly CareerRecord[];
  kind: RecordKind;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="narrow text-2xl leading-none font-extrabold uppercase">{heading}</h2>
      </header>
      {/* Two by two on anything above a phone, which is the pairing asked for:
          championships beside wins, podiums beside poles. */}
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <RecordCard
            key={card.metric}
            title={card.title}
            records={records}
            metric={card.metric}
            kind={kind}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * What the era adds up to: the leading careers, drivers then teams.
 *
 * Sits under the roll of honour and reads the same seasons — the roll says who
 * won each year, this says who won the era. Everything on it is derived on
 * render by `lib/records.ts`; nothing is counted as the run goes, which is the
 * project's rule and also what keeps a loaded save saying what it said before.
 *
 * Props-driven like every other screen here, so it renders without a DOM and
 * without a store.
 */
export function CareerStatistics({ seasons }: { seasons: readonly World[] }) {
  const teamNameIn = useTeamNameIn();
  const records = useMemo(() => careerRecords(seasons, teamNameIn), [seasons, teamNameIn]);
  return (
    <>
      <RecordSection heading="Driver statistics" records={records.drivers} kind="driver" />
      <RecordSection heading="Team statistics" records={records.teams} kind="team" />
    </>
  );
}
