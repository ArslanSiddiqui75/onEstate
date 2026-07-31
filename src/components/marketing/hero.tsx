"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { getActiveBrand } from "@/lib/brand/config";
import { BrandMark } from "@/components/brand/brand-mark";

export function Hero() {
  const reduce = useReducedMotion();
  const brand = getActiveBrand();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "10%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.35]);

  return (
    <section ref={ref} className="relative min-h-[100svh] overflow-hidden text-white">
      <motion.div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{
          y: reduce ? 0 : imageY,
          backgroundImage:
            "url(https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=80)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0" style={{ background: "var(--hero-overlay)" }} />
      <div className="marketing-grain absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--canvas)] to-transparent"
        aria-hidden
      />

      <motion.div
        style={{ y: reduce ? 0 : contentY, opacity: reduce ? 1 : opacity }}
        className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-24 pt-28 sm:px-8 lg:justify-center lg:pb-28"
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <BrandMark className="text-[clamp(3.5rem,12vw,8.75rem)] leading-[0.9] tracking-[-0.06em] text-white" />
        </motion.div>

        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-2xl text-[clamp(1.35rem,3vw,2rem)] font-medium leading-[1.2] text-white/92"
        >
          {brand.headline}
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-lg text-base text-white/68 sm:text-lg"
        >
          {brand.supporting}
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <Button asChild size="lg" className="rounded-full px-7">
            <a href="#ask">{brand.contactCta}</a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="rounded-full border-white/25 bg-white/5 text-white hover:bg-white/10"
          >
            <Link href="/app/signup" className="inline-flex items-center gap-1.5">
              Open the product
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
