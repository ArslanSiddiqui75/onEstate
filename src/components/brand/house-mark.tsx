import { cn } from "@/lib/utils";

/**
 * 3D house mark with a theme-stable layout box.
 * Light/dark assets have different intrinsic ratios; both are fitted into the
 * light asset's aspect so swapping themes never changes surrounding geometry.
 * Dark art is scaled to match visual weight (same as the loader / 404).
 */
export function HouseMark({
  className,
  animated = false,
}: {
  /** Size the box (width and/or height). Aspect locks to the light asset. */
  className?: string;
  animated?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[512/601]",
        animated && "logo-loader-mark",
        className,
      )}
      aria-hidden
    >
      <img
        src="/brand/loader-mark-light.webp"
        alt=""
        width={512}
        height={601}
        draggable={false}
        className="absolute inset-0 h-full w-full object-contain dark:hidden"
      />
      <img
        src="/brand/loader-mark-dark.webp"
        alt=""
        width={524}
        height={706}
        draggable={false}
        className="absolute inset-0 hidden h-full w-full origin-center scale-[1.26] object-contain dark:block"
      />
    </div>
  );
}
