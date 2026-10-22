import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/home";
import { requestMarket } from "@/lib/brand/request";

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await requestMarket();
  return {
    title: `${brand.name} ${brand.regionShort}`,
    description: brand.supporting,
  };
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  const { market, alternateHref } = await requestMarket();
  return <MarketingHome market={market} alternateHref={alternateHref} demo={demo} />;
}
