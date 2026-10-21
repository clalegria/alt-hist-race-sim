import type { CalendarRace, SeasonLineup } from "@alt-hist/data";
import {
  championshipStandings,
  constructorStandings,
  constructorsTitleClinchedBy,
  driversTitleClinchedBy,
  type RaceResult,
  type RaceWeather,
  type SeasonResult,
} from "@alt-hist/engine";
import { useId, useMemo, useState } from "react";
import { count } from "../lib/format.js";
import { keptNotes } from "../lib/kept.js";
import { driverCountry, driverName } from "../lib/names.js";
import { qualifyingOf, type RevealedWorld } from "../lib/reveal.js";
import { driverPoolOf, seatingArrangement } from "../lib/run-settings.js";
import type { SeasonTab, SeasonTabLink } from "../lib/season-tabs.js";
import { enteredSeason, historicalEngineRatings, seasonSeed } from "../lib/seasons.js";
import type { RoundPages, SessionNav } from "../lib/session-nav.js";
import { EDITING_LOCK } from "../lib/settings-lock.js";
import { positionsOf } from "../lib/standings.js";
import { tabMemory } from "../lib/tab-memory.js";
import type { View } from "../lib/timeline.js";
import { cn, MONO_LABEL } from "../lib/utils.js";
import { BackToSetup } from "./BackToSetup.js";
import { CompactStandings } from "./CompactStandings.js";
import { EntryNames, useEntryName, useTeamCountry } from "./EntryNames.js";
import { GridStage } from "./GridStage.js";
import { HomeAdvantage } from "./HomeAdvantage.js";
import { Liveries } from "./Liveries.js";
import { PageHeading } from "./PageHeading.js";
import { QualifyingResults } from "./QualifyingResults.js";
import { RaceClassification } from "./RaceClassification.js";
import type { RunChoice } from "./RunSettingsDialog.js";
import { RunSettingsLine } from "./RunSettingsLine.js";
import { SeasonOverview } from "./SeasonOverview.js";
import { SeasonSwitcher } from "./SeasonSwitcher.js";
import { SessionHeader } from "./SessionNav.js";
import { Tabs, tabIds } from "./Tabs.js";
import { TitleBanner } from "./TitleBanner.js";
import { Card, CardBand } from "./ui/card.js";
import type { GridEdit } from "./useGridDraft.js";

/** Where a round is held, for home advantage; empty if the calendar is short. */
function roundCountry(calendar: readonly CalendarRace[], round: number): string {
  return calendar[round]?.country ?? "";
}

/**
 * Everything raced up to and including a round.
 *
 * Mid-season standings need no special support: the championship is derived from
 * results on read, so a shorter list of results is simply an earlier table.
 */
function seasonSoFar(season: SeasonResult, throughRound: number): SeasonResult {
  return { races: season.races.slice(0, throughRound + 1) };
}

/**
 * One session's sheet. The round's name, flag and weather are the page's
 * header (`SessionHeader`), so the card says only which sheet this is, in the
 * same slim head band as the standings beside it.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardBand title={title} />
      {children}
    </Card>
  );
}

/** A race page's two halves, as tabs where they do not fit side by side. */
type RaceTab = "classification" | "standings";

const RACE_TABS: readonly { readonly key: RaceTab; readonly label: string }[] = [
  { key: "classification", label: "Classification" },
  { key: "standings", label: "Standings" },
];

/** The race tab last left on, which the next race opens on (`lib/tab-memory.ts`). */
const raceTabs = tabMemory<RaceTab>(
  "race",
  RACE_TABS.map((one) => one.key),
);

/**
 * A race: the classification, with the championship as it stands beside it.
 *
 * Two columns rather than two full tables stacked underneath. After a single
 * round the full table's wins, podiums, poles and retirement counts are mostly
 * zeroes; what a reader wants is who leads and by how much, which fits in a
 * sidebar and keeps the result itself on screen.
 *
 * Below `lg` there is no room beside it, so the two are tabs instead, under
 * the session switch: the standings a tap away rather than a scroll past
 * every finisher. Both panels are always rendered and CSS hides the one not
 * chosen below `lg` alone, so from `lg` up the tabs vanish and both show.
 */
function RaceStage({
  world,
  view,
  race,
}: {
  world: RevealedWorld;
  view: Extract<View, { kind: "race" }>;
  race: RaceResult;
}) {
  const nameOf = useEntryName();
  const countryOf = useTeamCountry();
  const soFar = useMemo(() => seasonSoFar(world.season, view.round), [world.season, view.round]);
  const points = world.points;
  const drivers = useMemo(() => championshipStandings(soFar, points), [soFar, points]);
  const constructors = useMemo(() => constructorStandings(soFar, points), [soFar, points]);

  // The table as it stood a round ago, so each row can show what it gained or
  // lost. Round one has no "before" and gets undefined, so nobody reads as
  // having climbed from nowhere. (An empty previous table would degrade to the
  // same thing — every lookup missing — but saying so outright is clearer than
  // relying on it.)
  const previous = useMemo(() => {
    if (view.round === 0) {
      return { drivers: undefined, constructors: undefined };
    }
    const before = seasonSoFar(world.season, view.round - 1);
    return {
      drivers: positionsOf(championshipStandings(before, points)),
      constructors: positionsOf(constructorStandings(before, points)),
    };
  }, [world.season, view.round, points]);

  const country = roundCountry(seasonSeed(world.year).calendar, view.round);
  // The season's length, not the races revealed: the clinch arithmetic needs
  // every round still to come.
  const total = world.season.rounds;
  const remaining = total - soFar.races.length;

  // Who, if anyone, can no longer be caught, and whether that became true on
  // this round. The banner is shown only on the round it happens; the standings
  // accent below stays from then on, which is what the two halves are for.
  const titles = useMemo(() => {
    const after = (round: number) => {
      const table = seasonSoFar(world.season, round);
      const left = total - table.races.length;
      return {
        driver: driversTitleClinchedBy(championshipStandings(table, points), left, points),
        team: constructorsTitleClinchedBy(constructorStandings(table, points), left, points),
      };
    };
    const now = after(view.round);
    const before = view.round === 0 ? { driver: null, team: null } : after(view.round - 1);
    return {
      driver: now.driver,
      driverIsNew: now.driver !== null && before.driver === null,
      team: now.team,
      teamIsNew: now.team !== null && before.team === null,
    };
  }, [world.season, view.round, total, points]);

  const [tab, setTab] = useState<RaceTab>(raceTabs.last);
  const idPrefix = useId();
  /** A panel's tab attributes, and below `lg` hidden unless it is the one chosen. */
  const panel = (key: RaceTab, className?: string) => {
    const ids = tabIds(idPrefix, key);
    return {
      role: "tabpanel",
      id: ids.panel,
      "aria-labelledby": ids.tab,
      className: cn(className, key !== tab && "max-lg:hidden"),
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        label="Race"
        className="-mt-2 self-end lg:hidden"
        panels={{
          items: RACE_TABS,
          selected: tab,
          idPrefix,
          onPick: (key) => {
            const picked = key as RaceTab;
            setTab(picked);
            raceTabs.remember(picked);
          },
        }}
      />
      {titles.driver !== null && titles.driverIsNew ? (
        <TitleBanner
          title="Drivers"
          name={driverName(titles.driver.driverId)}
          country={driverCountry(titles.driver.driverId)}
        />
      ) : null}
      {titles.team !== null && titles.teamIsNew ? (
        <TitleBanner
          title="Constructors"
          name={nameOf(titles.team.teamId)}
          country={countryOf(titles.team.teamId)}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div {...panel("classification")}>
          <Section title="Classification">
            <RaceClassification race={race} points={points} country={country} badge car podium />
          </Section>
        </div>

        <aside {...panel("standings", "flex flex-col gap-4")}>
          <p className={MONO_LABEL}>
            Championship after {count(soFar.races.length, "round")}
            {remaining === 0 ? "" : ` (${remaining} remaining)`}
          </p>
          <CompactStandings
            title="Drivers"
            standings={drivers}
            previousPositions={previous.drivers}
            clinchedBy={titles.driver?.driverId}
          />
          <CompactStandings
            title="Constructors"
            standings={constructors}
            previousPositions={previous.constructors}
            clinchedBy={titles.team?.teamId}
          />
        </aside>
      </div>
    </div>
  );
}

interface SeasonViewProps {
  /** The year as far as the reader has got (`revealYear`), never the whole of it. */
  readonly world: RevealedWorld;
  readonly view: View;
  /**
   * Whether this season is one year of an era: its settings are the era's, and
   * it offers no year switcher. Not derivable from the world: an era year and a
   * standalone season played as they were are the same world. Defaults to
   * false, so a bare render is the standalone case.
   */
  readonly inEra?: boolean;
  /**
   * Jump to the season either side of this one, from the grid.
   *
   * Absent inside an era, where the year belongs to the run rather than to the
   * reader — the switcher is not drawn at all then. Absent in tests too, where
   * nothing is clicked.
   */
  readonly onYearChange?: (year: number) => void;
  /** The same, for the grid editor: it draws without one, it just cannot apply. */
  readonly onGridChange?: (edit: GridEdit) => void;
  /**
   * Why the run settings can no longer be changed from this grid
   * (`settingsLock`), or null while they can. The settings line opens its
   * dialog read-only with this reason. Defaults to null, the untouched grid.
   */
  readonly settingsLock?: string | null;
  /** Changes the run settings, while `settingsLock` is null. Absent in tests. */
  readonly onSettingsChange?: (choice: RunChoice) => void;
  /**
   * On an era's first grid, why it cannot go back to the era's setup page, or
   * null while it can (`backToSetupLock`). Absent anywhere else, and the button
   * is not drawn.
   */
  readonly backToSetupLock?: string | null;
  /** Goes back to the era's setup page. Absent in tests. */
  readonly onBackToSetup?: () => void;
  /**
   * The previous season's grid as this run actually raced it, for the grid
   * editor's carry-over button.
   *
   * Absent on a standalone season, which has no year behind it, and on the
   * first year of an era: the button then copies the previous season as it was
   * entered, which is the only version of it there is.
   */
  readonly previousLineup?: SeasonLineup | null;
  /** Raised while the grid editor is open, so the page can hide the way forward. */
  readonly onGridEditingChange?: (editing: boolean) => void;
  /**
   * On the season's page, whether the reader has reached its summary: the
   * champions are drawn only then. Defaults to true, so a bare render of the
   * summary is the finished season.
   */
  readonly finished?: boolean;
  /** On the season's page, the tab on screen; the standings by default. */
  readonly tab?: SeasonTab;
  /** On the season's page, the links to its tabs. Absent in a test without a router. */
  readonly tabs?: readonly SeasonTabLink[];
  /** On the season's page, a round's pages for the calendar. Absent in a test without a router. */
  readonly pagesOf?: (round: number) => RoundPages;
  /** On a session's page, the links around it. Absent in a test without a router. */
  readonly sessionNav?: SessionNav | null;
}

/**
 * One point in the reveal, drawn.
 *
 * Separate from `SeasonView` only because the entry-name context has to be
 * *above* whatever reads it, and this is what reads it.
 */
function SeasonBody({
  world,
  view,
  inEra = false,
  onYearChange,
  onGridChange,
  onGridEditingChange,
  settingsLock = null,
  onSettingsChange,
  backToSetupLock,
  onBackToSetup,
  previousLineup = null,
  finished = true,
  tab = "standings",
  tabs,
  pagesOf,
  sessionNav,
}: SeasonViewProps) {
  // Whether the grid editor is open. The page is told too — it puts the way
  // forward away — but the year switcher below is drawn from this copy, so the
  // state has to be readable here rather than only raised.
  const [editingGrid, setEditingGrid] = useState(false);

  if (view.kind === "grid") {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <PageHeading
            title={`${world.year} grid`}
            sub={`Before round 1 of ${world.season.rounds}`}
          />
        </header>
        {/*
          The run settings next, in the place the setup screen has them, with
          the years next door beside them: both are facts about *which season
          this is*.

          The switcher is gone entirely while the grid editor is open, rather
          than disabled: a draft is a set of seats in *this* year's entry list,
          and switching year rebuilds the world underneath a half-finished one —
          which the editor's own preview then throws on. The settings open
          read-only then, for the same reason.
        */}
        <RunSettingsLine
          choice={{
            randomness: world.randomness,
            ratingMode: world.ratingMode,
            settings: world.settings,
          }}
          year={world.year}
          unit={inEra ? "era" : "season"}
          eraSettings={inEra}
          lock={editingGrid && settingsLock === null ? EDITING_LOCK : settingsLock}
          {...(onSettingsChange === undefined ? {} : { onCommit: onSettingsChange })}
          extra={
            !inEra && !editingGrid ? (
              <SeasonSwitcher
                year={world.year}
                {...(onYearChange === undefined ? {} : { onSwitch: onYearChange })}
              />
            ) : backToSetupLock !== undefined ? (
              <BackToSetup
                lock={editingGrid && backToSetupLock === null ? EDITING_LOCK : backToSetupLock}
                {...(onBackToSetup === undefined ? {} : { onBack: onBackToSetup })}
              />
            ) : null
          }
        />
        <GridStage
          field={world.field}
          year={world.year}
          ratingMode={world.ratingMode}
          lineup={world.lineup}
          engines={world.engines}
          chassis={world.chassis}
          engineRatings={world.engineRatings}
          trends={world.trends}
          baselineChassis={world.baselineChassis}
          historicalEngines={historicalEngineRatings(world)}
          runSeason={enteredSeason(world)}
          kept={keptNotes(world)}
          arrangement={seatingArrangement(world.settings)}
          previousLineup={previousLineup}
          pool={driverPoolOf(world.settings)}
          {...(onGridChange === undefined ? {} : { onApply: onGridChange })}
          onEditingChange={(editing) => {
            setEditingGrid(editing);
            onGridEditingChange?.(editing);
          }}
        />
      </div>
    );
  }

  if (view.kind === "summary") {
    return (
      <SeasonOverview
        world={world}
        finished={finished}
        tab={tab}
        {...(tabs === undefined ? {} : { tabs })}
        pagesOf={pagesOf}
      />
    );
  }

  const calendar = seasonSeed(world.year).calendar;
  const header = (weather: RaceWeather) => (
    <SessionHeader
      session={view.kind}
      round={view.round}
      rounds={world.season.rounds}
      race={calendar[view.round]}
      weather={weather}
      {...(sessionNav === undefined || sessionNav === null ? {} : { nav: sessionNav })}
    />
  );

  const sheet = view.kind === "qualifying" ? qualifyingOf(world.season, view.round) : undefined;
  if (view.kind === "qualifying" && sheet !== undefined) {
    const country = roundCountry(calendar, view.round);
    return (
      <>
        {/*
          The weather belongs to the whole weekend, not to Sunday: it widens
          qualifying's noise and shifts its weights exactly as it does the
          race's, so a wet round has to say so here too.
        */}
        {header(sheet.weather)}
        <Section title="Starting grid">
          <QualifyingResults race={sheet} country={country} />
        </Section>
      </>
    );
  }

  const race = view.kind === "race" ? world.season.races[view.round] : undefined;
  if (view.kind === "race" && race !== undefined) {
    return (
      <>
        {header(race.weather)}
        <RaceStage world={world} view={view} race={race} />
      </>
    );
  }
  return null;
}

/**
 * Everything between the header and the buttons, for one point in the reveal.
 *
 * Takes the world and the cursor as props rather than reading the store, so
 * every stage can be rendered and tested on its own. `App` is the thin shell
 * that connects it.
 *
 * Its own jobs are to publish **who is running whose engine**, **where everyone
 * on the grid is from** — both taken off the field as it was raced — and
 * **which season's colours apply**, so a livery overridden for this year is the
 * one drawn everywhere below.
 *
 * Every table names teams through the first, so "Williams-Ford" is the same
 * name in the standings, the classification, the qualifying sheet and the
 * summary — rather than six components each being handed a map they only pass
 * along.
 */
export function SeasonView(props: SeasonViewProps) {
  return (
    <EntryNames field={props.world.field}>
      <HomeAdvantage field={props.world.field}>
        <Liveries year={props.world.year}>
          <SeasonBody {...props} />
        </Liveries>
      </HomeAdvantage>
    </EntryNames>
  );
}
