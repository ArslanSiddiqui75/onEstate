"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Phone, PhoneMissed } from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";

/**
 * Drag comparison. The left of the line is the morning as it arrives.
 * The right is the same property once it is on the desk.
 */
export function BeforeAfter({ uk }: { uk: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const touched = useRef(false);
  const [value, setValue] = useState(42);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const apply = () => {
      if (touched.current) return;
      setValue(el.clientWidth < 640 ? 10 : 42);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function move(clientX: number) {
    touched.current = true;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect?.width) return;
    const next = ((clientX - rect.left) / rect.width) * 100;
    setValue(Math.min(88, Math.max(10, next)));
  }

  const property = uk ? "14 Elm Grove" : "14 Elm Street";
  const person = uk ? "vendor" : "seller";
  const appointment = uk ? "Viewing" : "Showing";
  const offer = uk ? "£425,000" : "$640,000";

  return (
    <div
      ref={stageRef}
      className="relative h-[36rem] w-full select-none overflow-hidden rounded-[1.75rem] border border-black/10 shadow-[var(--shadow-float)] sm:h-[40rem]"
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest("[data-slider-handle]")) return;
        move(event.clientX);
      }}
    >
      <Managed property={property} person={person} appointment={appointment} offer={offer} book={uk ? "Diary" : "Calendar"} />
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - value}% 0 0)` }}
        aria-hidden
      >
        <Scattered property={property} person={person} appointment={appointment} />
      </div>

      <div
        data-slider-handle
        role="slider"
        tabIndex={0}
        aria-valuemin={10}
        aria-valuemax={88}
        aria-valuenow={Math.round(value)}
        aria-label="Drag to compare the scattered morning with the managed desk"
        className="absolute inset-y-0 z-30 w-14 -translate-x-1/2 cursor-ew-resize touch-none outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ left: `${value}%` }}
        onPointerDown={(event) => {
          dragging.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          move(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return;
          move(event.clientX);
        }}
        onPointerUp={(event) => {
          dragging.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          touched.current = true;
          const delta = event.key === "ArrowLeft" ? -4 : 4;
          setValue((current) => Math.min(88, Math.max(10, current + delta)));
        }}
      >
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(7,16,21,0.45)]" />
        <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[#071015] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)]">
          <ArrowLeftRight className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function Scattered({
  property,
  person,
  appointment,
}: {
  property: string;
  person: string;
  appointment: string;
}) {
  return (
    <div className="absolute inset-0 bg-[#f3efe6]">
      <svg className="absolute inset-0 h-full w-full text-[#d9d0c2]" aria-hidden>
        <path
          d="M40 80 C 180 40, 260 160, 420 120 S 640 40, 820 150"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 7"
        />
        <path
          d="M20 280 C 160 340, 300 220, 480 300 S 700 420, 900 340"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 7"
        />
        <path
          d="M80 480 C 220 440, 340 560, 520 500 S 760 560, 980 470"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 7"
        />
      </svg>

      <div className="absolute left-[4%] top-[7%] w-[min(16rem,46%)] rotate-[-1.5deg] rounded-2xl bg-white px-3 py-2.5 shadow-[0_16px_40px_-24px_rgba(40,28,16,0.55)] sm:left-[6%] sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-[#6b6258] sm:text-xs">Calling…</p>
            <p className="font-sans text-lg font-semibold tracking-tight text-[#1c1916] sm:text-xl">00:08</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#e24b4b] text-white">
            <Phone className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <p className="mt-1 truncate text-[11px] text-[#6b6258]">Helen Croft · {property}</p>
      </div>

      <div className="absolute left-[12%] top-[23%] w-[min(13.5rem,26%)] rotate-[1.5deg] rounded-2xl bg-white px-3 py-2.5 shadow-[0_16px_40px_-24px_rgba(40,28,16,0.5)] sm:left-[16%]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-[#6b6258] sm:text-xs">Call unanswered</p>
            <p className="font-sans text-lg font-semibold tracking-tight text-[#1c1916] sm:text-xl">00:12</p>
          </div>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f3efe6] text-[#9a3b3b]">
            <PhoneMissed className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </div>

      <div className="absolute left-[3%] top-[38%] w-[min(22rem,58%)] overflow-hidden rounded-2xl bg-white shadow-[0_22px_50px_-28px_rgba(40,28,16,0.6)] sm:left-[5%]">
        <div className="flex items-center justify-between bg-[#2a3138] px-3 py-2 text-white">
          <p className="text-xs font-semibold">New message</p>
          <p className="text-[10px] text-white/60">Not on the file</p>
        </div>
        <div className="space-y-1 px-3 py-2 text-[11px] text-[#6b6258] sm:text-xs">
          <p>
            To <span className="text-[#1c1916]">Helen Croft</span>
          </p>
          <p>
            Subject <span className="text-[#1c1916]">{appointment} Thursday</span>
          </p>
        </div>
        <p className="border-t border-[#efeae2] px-3 py-2 text-[11px] leading-relaxed text-[#3d3832] sm:text-xs">
          Hi Helen, just checking you can still make 2 o&apos;clock at {property}.
        </p>
        <div className="px-3 pb-3">
          <span className="inline-flex h-7 items-center rounded-md bg-[#2f6fed] px-3 text-[11px] font-semibold text-white">
            Send
          </span>
        </div>
      </div>

      <div className="absolute bottom-[18%] left-[4%] max-w-[14rem] rounded-2xl rounded-bl-md bg-[#2f6fed] px-3 py-2 text-[11px] leading-relaxed text-white shadow-lg sm:bottom-[17%] sm:left-[8%] sm:max-w-[16rem] sm:text-xs">
        Is {property} still available? We asked on the portal this morning.
        <span className="mt-1 block text-[10px] text-white/70">Sam · buyer</span>
      </div>

      <div className="absolute bottom-[6%] left-[18%] hidden max-w-[13rem] rounded-2xl rounded-br-md bg-white px-3 py-2 text-[11px] leading-relaxed text-[#3d3832] shadow-lg sm:block sm:text-xs">
        Did anyone call the {person} back? The offer is still in my inbox.
        <span className="mt-1 block text-[10px] text-[#8a8176]">Office</span>
      </div>
    </div>
  );
}

function Managed({
  property,
  person,
  appointment,
  offer,
  book,
}: {
  property: string;
  person: string;
  appointment: string;
  offer: string;
  book: string;
}) {
  const rows = [
    ["08:14", "Enquiry", "Website", "On the file"],
    ["09:02", book, `Thu 14:00`, `${appointment} confirmed`],
    ["09:20", "Call", "2 min", `Noted for the ${person}`],
    ["10:05", "Offer", offer, "On progression"],
    ["10:18", "Link", `${person[0].toUpperCase()}${person.slice(1)} link`, "Sent"],
  ];

  return (
    <div className="absolute inset-0 bg-[#123f3a]">
      <div className="pointer-events-none absolute -right-16 top-0 h-72 w-72 rounded-full bg-[#17baa8]/25 blur-3xl" />
      <p className="absolute right-[6%] top-[6%] font-sans text-[clamp(3.2rem,8vw,6.5rem)] font-semibold leading-none tracking-[-0.05em] text-white sm:right-[7%]">
        Managed.
      </p>

      <div className="absolute bottom-[5%] right-[4%] top-[27%] w-[84%] overflow-hidden rounded-[1.35rem] border border-black/10 bg-white shadow-[0_30px_70px_-36px_rgba(0,0,0,0.55)] sm:top-[30%] sm:w-[min(28rem,52%)]">
        <div className="flex items-center justify-between gap-3 border-b border-[#ece7df] px-3 py-2.5 sm:px-4">
          <BrandMark tone="light" className="text-[13px]" />
          <p className="truncate text-[11px] font-medium text-[#6b6258] sm:text-xs">{property}</p>
        </div>
        <p className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0c6e63] sm:px-4">
          Today
        </p>
        <ul className="mt-1 divide-y divide-[#f1ece4] px-3 sm:px-4">
          {rows.map(([time, kind, detail, state]) => (
            <li key={kind} className="grid grid-cols-[2.6rem_1fr_auto] items-center gap-2 py-2.5 sm:grid-cols-[3.2rem_1fr_auto] sm:py-3">
              <span className="text-[10px] font-medium text-[#8a8176] sm:text-[11px]">{time}</span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-[#1c1916] sm:text-sm">{kind}</span>
                <span className="block truncate text-[10px] text-[#6b6258] sm:text-xs">{detail}</span>
              </span>
              <span className="rounded-full bg-[#e7f4f1] px-2 py-1 text-[10px] font-semibold text-[#0c6e63] sm:text-[11px]">
                {state}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
