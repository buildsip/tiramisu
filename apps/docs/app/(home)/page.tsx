import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { RiDiscordFill, RiGithubFill } from "@remixicon/react";
import { Card } from "fumadocs-ui/components/card";
import { docsRoute, gitConfig } from "@/lib/shared";
import { LandingHero } from "./components/landing-hero";
import { LogoMarquees } from "./components/logo-marquees";
import { ContextWords } from "./components/context-words";
import { FeatureIllustration } from "./components/feature-illustration";
import { features, gitBenefits } from "./landing-content";
import { cn } from "@/lib/cn";

const github = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;
const discord = "https://discord.gg/X4M5qynD88";

const section = "mx-auto max-w-7xl scroll-mt-20 px-5 pt-20 sm:px-8 sm:pt-28";
const heading = "mb-12 text-center max-sm:mb-8";
const title =
  "text-4xl leading-tight font-medium tracking-tight text-balance max-sm:text-3xl max-sm:tracking-tight";
// Fumadocs renders the title before the body. Order the illustration above both.
const card = cn(
  "flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-black p-0 text-neutral-100 no-underline transition-colors duration-200 hover:border-neutral-600 hover:bg-neutral-950 focus-visible:border-neutral-600 focus-visible:bg-neutral-950",
  "[&>div]:contents [&>h3]:order-1 [&>h3]:mx-6 [&>h3]:mt-6 [&>h3]:mb-0 [&>h3]:text-lg [&>h3]:leading-snug [&>h3]:font-medium [&>h3]:tracking-tight max-xl:[&>h3]:mx-6 max-xl:[&>h3]:mt-6 sm:max-lg:[&>h3]:text-base",
  // Between phone and desktop sizes, the third illustrated card spans both columns.
  "sm:max-lg:nth-3:col-span-full sm:max-lg:nth-3:grid sm:max-lg:nth-3:grid-cols-2 sm:max-lg:nth-3:items-center sm:max-lg:nth-3:[&_[data-illustration]]:col-start-1 sm:max-lg:nth-3:[&_[data-illustration]]:row-span-2 sm:max-lg:nth-3:[&_[data-illustration]]:row-start-1 sm:max-lg:nth-3:[&_[data-illustration]]:h-full sm:max-lg:nth-3:[&_[data-illustration]]:min-h-60 sm:max-lg:nth-3:[&>h3]:col-start-2 sm:max-lg:nth-3:[&>h3]:row-start-1 sm:max-lg:nth-3:[&>h3]:self-end sm:max-lg:nth-3:[&>div>p]:col-start-2 sm:max-lg:nth-3:[&>div>p]:row-start-2 sm:max-lg:nth-3:[&>div>p]:self-start",
);
const footerLink = "flex items-center gap-2 text-sm text-neutral-500";

/** Render the homepage; interactive sections manage their own client state. */
export default function HomePage() {
  return (
    <div className="bg-black text-sm text-neutral-100 antialiased [&_svg]:shrink-0 [&_:is(a,button)]:[-webkit-tap-highlight-color:transparent] [&_:is(a,button):focus-visible]:outline-2 [&_:is(a,button):focus-visible]:outline-neutral-300 [&_:is(a,button):focus-visible]:outline-offset-1 motion-reduce:[&_*]:transition-none motion-reduce:[&_*::before]:transition-none motion-reduce:[&_*::after]:transition-none">
      <LandingHero />
      <ContextWords />
      <LogoMarquees />

      <section id="features" className={section} aria-labelledby="features-title">
        <div className={heading}>
          <h2 id="features-title" className={title}>
            What’s in Tiramisu?
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3.5 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-3">
          {features.map((feature) => (
            <Card key={feature.title} title={feature.title} href={feature.href} className={card}>
              {feature.art && <FeatureIllustration kind={feature.art} />}
              {/* Override the Card body’s first and last paragraph margin reset. */}
              <p className="order-2 mx-6 mt-2! mb-6! text-sm leading-relaxed text-neutral-400 max-xl:mx-6 max-xl:mb-6!">
                {feature.description}
              </p>
            </Card>
          ))}
          <Link
            href={docsRoute}
            className="flex flex-col justify-between gap-5 rounded-xl border border-neutral-800 bg-[radial-gradient(ellipse_at_top_right,#171717,#040404_65%)] p-6 text-neutral-400 transition-colors duration-200 hover:border-neutral-600 max-sm:min-h-32"
          >
            <BookOpen size={21} strokeWidth={1.5} aria-hidden />
            <span className="flex items-center justify-between text-sm text-neutral-100">
              Explore the docs <ArrowUpRight size={18} aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      <section
        id="why-git"
        className={cn(section, "pt-28 sm:pt-36")}
        aria-labelledby="why-git-title"
      >
        <div className="mb-12 text-center sm:mb-20">
          <h2 id="why-git-title" className={title}>
            Why store curated memories in Git?
          </h2>
        </div>
        <div className="grid gap-10 md:grid-cols-3 md:gap-12">
          {gitBenefits.map(({ title, description, icon: Icon }) => (
            <div key={title}>
              <div className="mb-6 flex size-14 items-center justify-center rounded-full border border-neutral-800 text-neutral-500">
                <Icon className="size-6" strokeWidth={1.5} aria-hidden />
              </div>
              <h3 className="text-xl leading-snug font-medium tracking-tight">{title}</h3>
              <p className="mt-3 text-base leading-relaxed text-neutral-400">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={cn(section, "sm:pt-36")} aria-labelledby="tokens-title">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="tokens-title" className={title}>
            Use fewer tokens for memory
          </h2>
          <p className="mt-6 text-base leading-relaxed text-neutral-400 sm:text-lg">
            Tiramisu stores short, curated memories instead of full conversation transcripts and
            retrieves only what’s relevant to the current task.
          </p>
        </div>
      </section>

      <section
        id="get-started"
        className={cn(section, "pb-20 text-center sm:pt-36 sm:pb-32")}
        aria-labelledby="get-started-title"
      >
        <h2 id="get-started-title" className={title}>
          Build anything, remember what matters
        </h2>
        <Link
          href={docsRoute}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-neutral-100 px-6 text-sm font-medium text-neutral-950 transition-colors hover:bg-white"
        >
          Get started
        </Link>
      </section>

      <footer className="border-t border-neutral-800 px-5 pt-16 pb-16 sm:px-8 [&_a:hover]:text-white max-sm:px-6 max-sm:pt-10 max-sm:pb-10">
        <div className="mx-auto flex max-w-7xl justify-between gap-16 max-sm:flex-col max-sm:gap-10">
          <div>
            <Link
              className="flex items-center gap-2 text-2xl font-medium tracking-tight"
              href="/"
              aria-label="Tiramisu home"
            >
              <Image src="/logo.svg" width={32} height={32} alt="" /> Tiramisu
            </Link>
          </div>
          <nav
            aria-label="Footer"
            className="flex gap-28 pr-18 max-xl:pr-0 max-lg:gap-16 max-sm:gap-20 [&>div]:flex [&>div]:flex-col [&>div]:items-start [&>div]:gap-3 [&_span]:mb-1 [&_span]:text-sm"
          >
            <div>
              <span>Product</span>
              <Link href="#features" className={footerLink}>
                Features
              </Link>
              <Link href="#why-git" className={footerLink}>
                Why Git?
              </Link>
              <Link href={docsRoute} className={footerLink}>
                Documentation
              </Link>
            </div>
            <div>
              <span>Community</span>
              <a href={github} className={footerLink}>
                <RiGithubFill size={18} aria-hidden /> GitHub
              </a>
              <a href={discord} className={footerLink}>
                <RiDiscordFill size={18} aria-hidden /> Discord
              </a>
              <a href={`${github}/issues`} className={footerLink}>
                Feedback <ArrowUpRight size={14} aria-hidden />
              </a>
            </div>
          </nav>
        </div>
      </footer>
    </div>
  );
}
