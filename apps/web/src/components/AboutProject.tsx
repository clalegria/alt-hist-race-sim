import type { ReactNode } from "react";
import type { AboutTab, AboutTabLink } from "../lib/about-tabs.js";
import { PLAYABLE_SEASONS } from "../lib/seasons.js";
import { cn, DISPLAY_CAPS } from "../lib/utils.js";
import { type Release, releaseDate } from "../lib/whats-new.js";
import { PageHeading } from "./PageHeading.js";
import { Tabs } from "./Tabs.js";

/**
 * The About page: who made this and why, and what's new in each release.
 *
 * The words are the author's draft, theirs to rewrite (`web-about.md`). Like
 * the season page, the tab and the releases are props, so it renders in a test
 * without a router or the real file.
 */
export function AboutProject({
  tab,
  tabs,
  releases,
}: {
  tab: AboutTab;
  /** The tabs as links; absent in a test without a router. */
  tabs?: readonly AboutTabLink[];
  releases: readonly Release[];
}) {
  return (
    <div className="flex flex-col gap-6 py-6 sm:py-10">
      <PageHeading title="About this project" />
      {tabs === undefined ? null : <Tabs label="About" className="self-start" links={tabs} />}
      {tab === "about" ? <About /> : <WhatsNew releases={releases} />}
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

function About() {
  return (
    <div className={PROSE}>
      <Section heading="Who I am">
        <p>
          I&rsquo;m Claudio Alegria, a programmer and motor racing fan. This is a hobby project, and
          my first web app.
        </p>
      </Section>
      <Section heading="What this is">
        <p>
          An alternate history of motor racing. Pick any season from {PLAYABLE_SEASONS[0]} to{" "}
          {PLAYABLE_SEASONS.at(-1)} and race it again, or keep going year after year and watch a
          different history unfold. Every run starts from the real grid; it&rsquo;s a what-if, not a
          prediction.
        </p>
      </Section>
      <Section heading="How it works">
        <p>
          Every driver, car and engine has a rating. Each race is decided by those ratings plus a
          share of luck, so the best car usually wins, but not always. Over the years drivers
          improve, peak, slow down and retire, and every statistic is counted from the results.
        </p>
      </Section>
      <Section heading="The ratings">
        <p>
          Every rating is my own opinion, and most are still first drafts. If one looks wrong to
          you, it may well be: I&rsquo;m still working through them.
        </p>
      </Section>
      <Section heading="Where it's going">
        <p>
          Next, an editor to change any rating and race your own what-if. After that: careers that
          start with their real records, circuits that suit some cars more than others, drivers
          moving between teams, and a mode where you run a team yourself.
        </p>
      </Section>
      <Section heading="How it was made">
        <p>
          With Anthropic&rsquo;s Claude Code: the AI wrote nearly all of the code, while I decided
          what to build and how it should look, and wrote the ratings.
        </p>
      </Section>
      <Section heading="Credits">
        <p>
          The real results the model is checked against come from{" "}
          <Out href="https://jolpi.ca">Jolpica</Out>, under{" "}
          <Out href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</Out>.
        </p>
        <p>
          The code is on <Out href={REPOSITORY}>GitHub</Out>. Code and ratings &copy; 2026 Claudio
          Alegria, all rights reserved.
        </p>
        <p>
          An unofficial fan project, not connected to any championship, governing body or team. Real
          names are used only to describe real history.
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
