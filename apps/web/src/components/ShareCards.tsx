/**
 * The four share cards, each laid out on `ShareCardFrame` from its data in
 * `lib/share-card.ts`: an era's champion of champions and last champions, a
 * season's world champion and final standings.
 *
 * Nothing here decides who is listed or in what order; that is the data's.
 * Every team is named and painted at the year it travels with, through the
 * run's kept-names and kept-liveries contexts, as every other screen does.
 *
 * **Every list fits at its longest.** A card is a fixed frame, so the rows are
 * sized for the most each list can hold (`STANDINGS_SHOWN`, `LAST_CHAMPIONS_SHOWN`)
 * with the car band at its floor; a shorter list hands the band the room.
 */

import type { ReactNode } from "react";
import { count } from "../lib/format.js";
import { ordinal } from "../lib/history.js";
import { driverCountry, driverName, nameParts, shortName } from "../lib/names.js";
import {
  type ChampionOfChampionsCard,
  type FinalStandingsCard,
  headingLine,
  type LastChampionsCard,
  lineageName,
  type RestOfChampions,
  type WorldChampionCard,
  winnerColumns,
} from "../lib/share-card.js";
import { cn, MONO_LABEL, TIMING_NAME } from "../lib/utils.js";
import { useTeamNameIn } from "./EntryNames.js";
import { FittedName, SplitName } from "./FittedName.js";
import {
  CardBadge,
  CardCar,
  CardFlag,
  CardPanel,
  FitToWidth,
  PositionBlock,
  SeasonMark,
  ShareCardFrame,
  SubjectEntry,
  SubjectFigure,
  SubjectName,
} from "./ShareCard.js";

/** "Ferrari", "Benetton and Ferrari", "Brabham, Williams and Ferrari". */
const LIST = new Intl.ListFormat("en-GB", { type: "conjunction" });

/** A row's flag: smaller than the subject's. */
const ROW_FLAG = "h-[28px] w-[42px]";
/** A row's driver, as the app's tables set one, at the card's scale. */
const ROW_NAME = "text-[38px] leading-none";
/** A team beside a driver in a row: the badge, then the name in plain words. */
const ROW_TEAM =
  "semi-narrow text-muted-foreground flex min-w-0 items-center gap-[12px] text-[28px] font-medium";
/** The standings' wins and points columns, which the head band's keys line up over. */
const FIGURES = "grid-cols-[70px_80px]";
/** A column of figures, right-aligned in the mono face. */
const FIGURE = "text-right text-[30px] tabular-nums";

/** A row's flag, or the room for one: a driver with no nationality keeps the column. */
function RowFlag({ driverId }: { driverId: string }) {
  const country = driverCountry(driverId);
  return country === undefined ? <span /> : <CardFlag country={country} className={ROW_FLAG} />;
}

/** A driver in a row, fitted to the column: "Nelson PIQUET", then "N. PIQUET". */
function RowName({
  driverId,
  after,
  className,
}: {
  driverId: string;
  after?: ReactNode;
  className?: string;
}) {
  const full = driverName(driverId);
  return (
    <FittedName
      full={full}
      short={shortName(full)}
      className={cn(ROW_NAME, className)}
      render={(name) => (
        <>
          <SplitName name={name} />
          {after}
        </>
      )}
    />
  );
}

/** A team as a row names it in `year`: the badge, then the name. */
function RowTeam({ teamId, year }: { teamId: string; year: number }) {
  const name = useTeamNameIn()(teamId, year);
  return (
    <span className={ROW_TEAM}>
      <CardBadge teamId={teamId} year={year} className="size-[34px]" />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The rows of a list panel, striped as the app's tables are. */
function Rows({ children }: { children: ReactNode }) {
  return <div className="striped">{children}</div>;
}

/**
 * The Constructors' top three across a panel's foot: badge, name, figure, in
 * `em` so that three long names shrink together to fit the line.
 */
function ConstructorsFoot({
  teams,
}: {
  teams: readonly { readonly teamId: string; readonly year: number; readonly figure: number }[];
}) {
  const nameIn = useTeamNameIn();
  return (
    <>
      <span className={cn(MONO_LABEL, "text-subtle shrink-0 text-[18px] tracking-[0.16em]")}>
        Constructors'
      </span>
      <FitToWidth className="min-w-0 flex-1 text-[34px]">
        <span className="flex items-center justify-end gap-[0.65em]">
          {teams.map(({ teamId, year, figure }) => (
            <span key={teamId} className="flex items-center gap-[0.35em]">
              <CardBadge teamId={teamId} year={year} className="size-[1.06em]" />
              <span className={cn(TIMING_NAME, "leading-none")}>{nameIn(teamId, year)}</span>
              <span className="text-primary text-[0.82em] font-semibold tabular-nums">
                {figure}
              </span>
            </span>
          ))}
        </span>
      </FitToWidth>
    </>
  );
}

/** "I replayed history and my champion of champions is…" and the panel under it. */
export function ChampionOfChampionsShare({ card }: { card: ChampionOfChampionsCard }) {
  const { champion } = card;
  const nameIn = useTeamNameIn();
  const country = driverCountry(champion.id);
  const titles = champion.titles.length;
  const teams = LIST.format(champion.teams.map((team) => lineageName(team, nameIn)));
  return (
    <ShareCardFrame
      heading={headingLine(card.heading)}
      lead={{
        before: "I replayed history and my",
        emphasis: "champion of champions",
        after: "is…",
      }}
      subject={
        <>
          <SubjectName driverId={champion.id} />
          <SubjectEntry>
            {country === undefined ? null : (
              <CardFlag country={country} className="h-[38px] w-[57px]" />
            )}
            <span>{`${titles === 1 ? "Title" : "Titles"} with ${teams}`}</span>
          </SubjectEntry>
          <SubjectFigure value={titles} label={titles === 1 ? "World title" : "World titles"}>
            <SeasonMarks titles={champion.titles} large />
          </SubjectFigure>
        </>
      }
      car={champion.car}
    >
      <CardPanel
        label="The other champions"
        aside="titles · seasons"
        {...(card.constructors.length === 0
          ? {}
          : {
              foot: (
                <ConstructorsFoot
                  teams={card.constructors.map(({ titles: won, team }) => ({
                    ...team,
                    figure: won,
                  }))}
                />
              ),
            })}
      >
        <Rows>
          {card.others.map(({ id, titles: won }) => (
            <div
              key={id}
              className="grid min-h-[50px] grid-cols-[42px_340px_44px_minmax(0,1fr)] items-center gap-[18px] px-[24px] py-[4px]"
            >
              <RowFlag driverId={id} />
              <RowName driverId={id} />
              <span className="text-primary text-right text-[32px] font-semibold tabular-nums">
                {won.length}
              </span>
              <SeasonMarks titles={won} />
            </div>
          ))}
        </Rows>
        <RestSentence rest={card.rest} />
      </CardPanel>
    </ShareCardFrame>
  );
}

/** A champion's seasons won, oldest first, each in its year's colours. */
function SeasonMarks({
  titles,
  large = false,
}: {
  titles: readonly { readonly teamId: string; readonly year: number }[];
  large?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex flex-wrap",
        large ? "gap-x-[14px] gap-y-[8px]" : "gap-x-[10px] gap-y-[6px]",
      )}
    >
      {titles.map(({ teamId, year }) => (
        <SeasonMark key={year} teamId={teamId} year={year} large={large} />
      ))}
    </span>
  );
}

/** "3 titles: Jack Brabham. 2 titles: …. And 14 more champions once each." */
function RestSentence({ rest }: { rest: RestOfChampions }) {
  if (rest.named.length === 0 && rest.once === 0) {
    return null;
  }
  return (
    <p className="semi-narrow text-muted-foreground border-border border-t-2 px-[24px] pt-[12px] pb-[14px] text-[26px] leading-[1.3]">
      {rest.named.map(({ titles, driverIds }) => (
        <span key={titles}>
          {`${count(titles, "title")}: `}
          <b className="text-foreground font-bold">{LIST.format(driverIds.map(driverName))}</b>
          {". "}
        </span>
      ))}
      {rest.once === 0
        ? null
        : `${rest.named.length === 0 ? "" : "And "}${count(rest.once, "more champion")} ${rest.once === 1 ? "once" : "once each"}.`}
    </p>
  );
}

/** "I replayed history and these are my last 20 champions" and the roll of honour. */
export function LastChampionsShare({ card }: { card: LastChampionsCard }) {
  const newest = card.rows[0]?.year;
  const oldest = card.rows.at(-1)?.year;
  // Only an era longer than the list says "last": a shorter one lists every season.
  const emphasis =
    card.heading.seasons > card.rows.length
      ? `last ${count(card.rows.length, "champion")}`
      : "champions";
  return (
    <ShareCardFrame
      heading={headingLine(card.heading)}
      lead={{ before: "I replayed history and these are my", emphasis }}
      car={card.car}
    >
      <CardPanel
        label="Roll of honour"
        aside={
          <span className="tabular-nums">
            {newest === oldest ? newest : `${newest} → ${oldest}`}
          </span>
        }
      >
        <Rows>
          {card.rows.map(({ year, driverId, teamId, title }) => (
            <div
              key={year}
              className="grid h-[56px] grid-cols-[76px_42px_minmax(0,1fr)_260px] items-center gap-[18px] px-[24px]"
            >
              <span
                className={cn(
                  "text-[28px] tabular-nums",
                  year === newest ? "text-primary" : "text-subtle",
                )}
              >
                {year}
              </span>
              <RowFlag driverId={driverId} />
              <RowName
                driverId={driverId}
                after={
                  title === 1 ? null : (
                    <span className="text-primary ml-[10px] text-[22px] font-semibold tabular-nums">
                      {ordinal(title)}
                    </span>
                  )
                }
              />
              <RowTeam teamId={teamId} year={year} />
            </div>
          ))}
        </Rows>
      </CardPanel>
    </ShareCardFrame>
  );
}

/** The heights of the podium's blocks, first, second and third. */
const STEP_HEIGHTS = [170, 140, 120] as const;
/** The podium's order across the card: second, first, third. */
const PODIUM_ORDER = [1, 0, 2] as const;

/** "I replayed 1986 and my world champion is…", the podium and every race's winner. */
export function WorldChampionShare({ card }: { card: WorldChampionCard }) {
  const { year } = card.heading;
  const { champion } = card;
  const nameIn = useTeamNameIn();
  const country = driverCountry(champion.driverId);
  const columns = winnerColumns(card.winners.length);
  const runnerUp = card.runnerUpId === null ? null : nameParts(driverName(card.runnerUpId)).surname;
  return (
    <ShareCardFrame
      heading={headingLine(card.heading)}
      lead={{ before: `I replayed ${year} and my`, emphasis: "world champion", after: "is…" }}
      subject={
        <>
          <SubjectName driverId={champion.driverId} />
          <SubjectEntry>
            {country === undefined ? null : (
              <CardFlag country={country} className="h-[38px] w-[57px]" />
            )}
            <CardBadge teamId={champion.teamId} year={year} />
            <span>{`${nameIn(champion.teamId, year)} · ${count(champion.wins, "win")}`}</span>
          </SubjectEntry>
          <SubjectFigure value={champion.points} label="Points">
            {card.margin === null || runnerUp === null ? null : (
              <p className="semi-narrow text-muted-foreground text-[30px]">
                {card.margin === 0
                  ? `Level with ${runnerUp}`
                  : `${card.margin} clear of ${runnerUp}`}
              </p>
            )}
          </SubjectFigure>
        </>
      }
      car={{ teamId: champion.teamId, year }}
    >
      <div className="grid grid-cols-3 items-end gap-[10px]">
        {PODIUM_ORDER.map((index) => {
          const place = card.podium[index];
          return place === undefined ? (
            <span key={index} />
          ) : (
            <PodiumStep key={place.driverId} place={place} position={index + 1} year={year} />
          );
        })}
      </div>
      <CardPanel
        label="Race winners"
        aside="round by round"
        {...(card.constructors.length === 0
          ? {}
          : {
              foot: (
                <ConstructorsFoot
                  teams={card.constructors.map(({ teamId, points }) => ({
                    teamId,
                    year,
                    figure: points,
                  }))}
                />
              ),
            })}
      >
        <div
          className="striped grid"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {card.winners.map(({ round, name, country: at, winner, champion: won }) => (
            <div
              key={round}
              title={name}
              className={cn(
                "grid justify-items-center gap-[6px] py-[10px]",
                round > columns && "border-border border-t-2",
              )}
            >
              {at === undefined ? (
                <span className="h-[24px]" />
              ) : (
                <CardFlag country={at} className="h-[24px] w-[36px]" />
              )}
              {winner === null ? (
                <span className="size-[38px]" />
              ) : (
                <CardBadge teamId={winner.teamId} year={year} className="size-[38px]" />
              )}
              <span className={cn(TIMING_NAME, "text-[26px] leading-none", won && "text-primary")}>
                {winner?.code ?? "—"}
              </span>
            </div>
          ))}
        </div>
      </CardPanel>
    </ShareCardFrame>
  );
}

/** One step of the podium: the car over a block, the champion's filled with the accent. */
function PodiumStep({
  place,
  position,
  year,
}: {
  place: { readonly driverId: string; readonly teamId: string; readonly points: number };
  position: number;
  year: number;
}) {
  const first = position === 1;
  return (
    <div className="grid justify-items-center gap-[8px]">
      <div className="w-[220px]">
        <CardCar teamId={place.teamId} year={year} />
      </div>
      <div
        className={cn(
          "grid w-full content-center justify-items-center gap-[2px] border-2 px-[12px]",
          first
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-card-header border-border",
        )}
        style={{ height: STEP_HEIGHTS[position - 1] }}
      >
        <span
          className={cn(
            "text-[44px] leading-none font-semibold tabular-nums",
            !first && "text-primary",
          )}
        >
          {position}
        </span>
        {/* The column's width, not the name's, or it would never be short of room. */}
        <RowName driverId={place.driverId} className="justify-self-stretch text-center" />
        <span
          className={cn("text-[22px] tabular-nums", !first && "text-muted-foreground")}
        >{`${place.points} pts`}</span>
      </div>
    </div>
  );
}

/** "I replayed 1986 and this is how my championship finished" and the Drivers' table. */
export function FinalStandingsShare({ card }: { card: FinalStandingsCard }) {
  const { year } = card.heading;
  return (
    <ShareCardFrame
      heading={headingLine(card.heading)}
      lead={{
        before: `I replayed ${year} and this is how my`,
        emphasis: "championship",
        after: "finished",
      }}
      car={card.car}
    >
      <CardPanel
        label="Drivers' Championship"
        aside={
          <span className={cn("grid gap-[18px] text-right", FIGURES)}>
            <span>Wins</span>
            <span>Pts</span>
          </span>
        }
      >
        <Rows>
          {card.rows.map(({ position, driverId, teamId, wins, points }) => (
            <div
              key={driverId}
              className="grid h-[56px] grid-cols-[44px_42px_minmax(0,1fr)_250px_70px_80px] items-center gap-[18px] px-[24px]"
            >
              <PositionBlock position={position} />
              <RowFlag driverId={driverId} />
              <RowName driverId={driverId} />
              <RowTeam teamId={teamId} year={year} />
              <span className={cn(FIGURE, "text-primary font-semibold")}>
                {wins === 0 ? "" : wins}
              </span>
              <span className={FIGURE}>{points}</span>
            </div>
          ))}
        </Rows>
      </CardPanel>
    </ShareCardFrame>
  );
}
