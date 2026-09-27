import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ToolLandingPage } from '@/app/components/public/ToolLandingPage';
import { publicMetadata } from '@/lib/public-site';
import { getPublicTool, getPublicTools } from '@/lib/public-tools';

type ToolPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getPublicTools().map((tool) => ({ slug: tool.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: ToolPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getPublicTool(slug);
  if (!tool) {
    return { title: 'Tool not found', robots: { index: false, follow: false } };
  }

  return publicMetadata({
    title: tool.seoTitle,
    description: tool.seoDescription,
    path: `/tools/${tool.slug}`,
    keywords: tool.keywords,
    index: tool.indexable,
  });
}

export default async function PublicToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const tool = getPublicTool(slug);
  if (!tool) notFound();
  return <ToolLandingPage tool={tool} />;
}
