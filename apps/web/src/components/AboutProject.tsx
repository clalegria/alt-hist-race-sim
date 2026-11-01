import type { ReactNode } from "react";
import type { AboutTab, AboutTabLink } from "../lib/about-tabs.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { cn, DISPLAY_CAPS } from "../lib/utils.js";
import { type Release, releaseDate } from "../lib/whats-new.js";
import { PageHeading } from "./PageHeading.js";
import { Tabs } from "./Tabs.js";

/**
 * The About page: who made this and why, what's new in each release, what is
 * known to be missing or wrong, and where to report a bug.
 *
 * The words are the author's, theirs to rewrite (`web-about.md`). Like the
 * season page, the tab and the releases are props, so it renders in a test
 * without a router or the real file.
 */
export function AboutProject({
  tab,
  tabs,
  releases,
  today = new Date(),
}: {
  tab: AboutTab;
  /** The tabs as links; absent in a test without a router. */
  tabs?: readonly AboutTabLink[];
  releases: readonly Release[];
  /** The day the author's age is counted on; a test fixes it. */
  today?: Date;
}) {
  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeading title="About this project" />
      {tabs === undefined ? null : <Tabs label="About" className="self-start" links={tabs} />}
      {tab === "about" ? (
        <About today={today} />
      ) : tab === "whats-new" ? (
        <WhatsNew releases={releases} />
      ) : tab === "known-issues" ? (
        <KnownIssues />
      ) : (
        <p className="text-muted-foreground">Not available yet.</p>
      )}
    </div>
  );
}

const PROSE = "flex max-w-[65ch] flex-col gap-8";

function Section({ heading, children }: { heading: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className={cn(DISPLAY_CAPS, "text-2xl leading-none")}>{heading}</h2>
      {children}
    </section>
  );
}

/** A link out of the app, in running text: underlined, since colour alone is not enough. */
function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} rel="noreferrer" className="text-primary underline underline-offset-3">
      {children}
    </a>
  );
}

const REPOSITORY = "https://github.com/clalegria/alt-hist-race-sim";

/** The author's birthday, as year, month (1–12) and day. */
const AUTHOR_BORN = { year: 1986, month: 2, day: 25 } as const;

/**
 * How old someone born on `born` is on `today`, in the reader's own calendar:
 * a year older from their birthday on.
 */
export function yearsOld(
  born: { readonly year: number; readonly month: number; readonly day: number },
  today: Date,
): number {
  const month = today.getMonth() + 1;
  const birthdayPassed =
    month > born.month || (month === born.month && today.getDate() >= born.day);
  return today.getFullYear() - born.year - (birthdayPassed ? 0 : 1);
}

function About({ today }: { today: Date }) {
  return (
    <div className={PROSE}>
      <Section heading="Who I am">
        <p>
          I&rsquo;m Cláudio, a {yearsOld(AUTHOR_BORN, today)} year old software developer from
          Madeira Island, Portugal, specialized in legacy banking applications. In 2026 I got
          interested into exploring AI vibe-coding capabilities and decided to create a few hobby
          projects, including this one, to test how capable AI is at coding right now, how it
          handles complexity as a project&rsquo;s scope and number of features increases, and also
          to gain knowledge and familiarity myself of how to work with AI and how modern web
          development works.
        </p>
      </Section>
      <Section heading="What is this? Is this a game?">
        <p>
          Maybe one day? Everytime I show this to someone, they think I&rsquo;m developing a
          motorsport team management game. It <em>could</em> one day become that kind of game, but
          for now it&rsquo;s not quite there.
        </p>
        <p>
          Right now, you could think of it as a game where you&rsquo;re not playing, but merely
          watching the AI teams play each other. You start in any season from motorsport history
          (from {PLAYABLE_SEASONS[0]} onwards) and you watch race results play out in an alternate
          universe as AI teams race each other.
        </p>
      </Section>
      <Section heading="Right now, what can I use this for?">
        <p>
          Well, you could use it to simulate alternate realities where your favourite driver joined
          a better team at a certain point of his career. Or what if teams were stronger or weaker.
          Try out the several different pre-made scenarios, and/or edit the grid, and see what
          happens. You could also just leave it on default settings, and see what would happen if
          everything in the past was the exact same, except luck fell for different teams and
          drivers in a different way.
        </p>
      </Section>
      <Section heading="How does it work?">
        <p>
          I&rsquo;ve assigned a bunch of different rating numbers, with the assistance of AI - which
          I&rsquo;ve later tweaked by hand - to drivers and teams. Drivers get better/faster as they
          gain experience and then get worse/slower as they age until they retire. Car chassis and
          engines have their own numbers per season too. Then it all gets mashed together in a
          simulation engine that simulates results for the qualifying sessions and races.
        </p>
        <p>
          Ratings have been quite extensively tweaked by hand for more modern seasons to make
          results very close to real life results (through a bunch of calibration scripts Claude
          generated for me), but the further back you go, the more mistakes you may find, as they
          were initially all generated by AI.
        </p>
        <p>
          Obviously, this is a rudimentary way of representing performance and is entirely
          subjective: please don&rsquo;t get mad at me if you feel your favourite driver is
          undervalued. 🙂 A feature is planned so that anyone can come here and go edit the ratings.
        </p>
      </Section>
      <Section heading="What's next?">
        <p>
          Currently seasons play out very rigidly, and even if you use any of the pre-determined
          scenarios, drivers will just move teams at random or without much logic. The next big
          feature I&rsquo;m planning is the &ldquo;advanced simulation mode&rdquo;, where a driver
          market will make drivers move around according to events - a big team hiring a promising
          driver shining on a smaller team, or a big reputation driver getting fed up with lack of
          success at his team and deciding to leave, etc.
        </p>
        <p>
          I would like it to make this a game at some stage, where you take over a team and decide
          its fate, but I&rsquo;m struggling a bit to imagine what kind of game mechanics would make
          it fun - typically management sims have A LOT of different game mechanics to make it
          interesting and engaging, and I simply don&rsquo;t have the time to develop all of what it
          would take. For example, currently the race results engine just spits out results and
          gives no thought whatsoever to strategy or what happens lap by lap, etc - you just
          can&rsquo;t have a management game without strategy. There would have to be several
          different mini-games so you can decide the direction of car development. Etc. Not sure
          I&rsquo;ve got the skill level and time to give the game the depth it would need, though I
          don&rsquo;t rule out at some stage making it a very simple game where you merely hire and
          fire drivers and do a couple more mini-games and that&rsquo;s it.
        </p>
      </Section>
      <Section heading="How it was made">
        <p>
          Pretty much 99% vibe-coded by Claude Code (mostly within the VSCode extension), though I
          did touch the ratings files manually a lot. I did still put quite a bit of work into this
          though, this was not done on a single one-shot prompt, as of early November 2026 I think
          it took something around 800 to 1000 prompts. Lots of work trying to make the UI usable on
          both desktop and mobile devices (and I&rsquo;m still not happy with it...)
        </p>
        <p>
          Architecture is mostly Typescript, React, Vite, Zustand. No database as of yet, all data
          resides on JSON files and is all loaded up into the browser. You can check the codebase on
          my <Out href={REPOSITORY}>Github</Out>.
        </p>
      </Section>
      <Section heading="Credits">
        <p>
          See my <Out href={REPOSITORY}>Github</Out>. &copy; 2026 Cláudio Alegria, all rights
          reserved.
        </p>
        <p>
          Unofficial fan project, not connected to any championship, governing body, team or brand.
          The usage of real names is merely to give users a connection to motorsport history.
        </p>
        <p>
          The ratings data was checked and calibrated against real life motorsport data from{" "}
          <Out href="https://jolpi.ca">Jolpica</Out>, under{" "}
          <Out href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</Out>.
        </p>
      </Section>
    </div>
  );
}

function WhatsNew({ releases }: { releases: readonly Release[] }) {
  if (releases.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nothing yet: the first entry comes with the first release.
      </p>
    );
  }
  return (
    <div className={PROSE}>
      {releases.map((release) => (
        <Section
          key={release.date}
          heading={<time dateTime={release.date}>{releaseDate(release.date)}</time>}
        >
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {release.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Section>
      ))}
    </div>
  );
}

/** What is known to be missing or wrong, each said once and plainly. A draft, the author's to rewrite. */
const KNOWN_ISSUES: readonly string[] = [
  "Drivers move between teams at random, or without much logic.",
  "The further back in history you go, the rougher the ratings: older seasons are mostly still AI's first drafts.",
  "Races are decided as a whole: there is no strategy, and nothing happens lap by lap.",
  "The layout on phones still needs work.",
  "Bug reports can't be sent from the app yet.",
];

function KnownIssues() {
  return (
    <div className={PROSE}>
      <ul className="flex list-disc flex-col gap-1.5 pl-5">
        {KNOWN_ISSUES.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}
