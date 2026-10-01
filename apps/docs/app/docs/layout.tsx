import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { CommunityLinks } from '@/components/community-links';
import { baseOptions } from '@/lib/layout.shared';
import { source } from '@/lib/source';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      {...baseOptions()}
      // Community cards replace the default GitHub icon in the docs footer.
      githubUrl={undefined}
      sidebar={{ banner: <CommunityLinks /> }}
    >
      {children}
    </DocsLayout>
  );
}
