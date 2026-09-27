import { RiDiscordFill, RiGithubFill } from '@remixicon/react';
import { gitConfig } from '@/lib/shared';

const links = [
  {
    label: 'GitHub',
    href: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    icon: RiGithubFill,
  },
  {
    label: 'Discord',
    href: 'https://discord.gg/X4M5qynD88',
    icon: RiDiscordFill,
  },
];

/** Keep community links visible above the docs navigation in both sidebar layouts. */
export function CommunityLinks() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {/* Match Fumadocs' footer surface with a separate, equally sized card for each link. */}
      {links.map(({ label, href, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center justify-center gap-2 rounded-lg border bg-fd-secondary/50 px-3 py-1.5 text-sm font-medium text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-ring"
        >
          <Icon aria-hidden="true" className="size-5 shrink-0" />
          {label}
        </a>
      ))}
    </div>
  );
}
