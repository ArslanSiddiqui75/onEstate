import type { Metadata } from "next";
import { MarketingHome } from "@/components/marketing/home";
import { getBrandByMarket } from "@/lib/brand/config";

const brand = getBrandByMarket("us");

export const metadata: Metadata = {
  title: `${brand.name} US`,
  description: brand.supporting,
};

export default async function UsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const { demo } = await searchParams;
  return <MarketingHome market="us" demo={demo} />;
}
