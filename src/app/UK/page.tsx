import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/home";
import { getBrandByMarket } from "@/lib/brand/config";

const brand = getBrandByMarket("uk");

export const metadata: Metadata = {
  title: `${brand.name} UK`,
  description: brand.supporting,
};

export default async function UkHomePage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <MarketingHome market="uk" demo={demo} />;
}
