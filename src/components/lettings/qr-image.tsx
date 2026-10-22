"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, label }: { value: string; label: string }) {
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let cancel = false;
    void QRCode.toString(value, {
      type: "svg",
      margin: 1,
      width: 168,
      color: { dark: "#14221f", light: "#ffffff" },
    }).then((next) => {
      if (!cancel) setSvg(next);
    });
    return () => {
      cancel = true;
    };
  }, [value]);

  return (
    <div className="inline-flex rounded-2xl bg-white p-2 shadow-[var(--shadow-soft)]" aria-label={label} role="img">
      {svg ? (
        <div className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="h-40 w-40 animate-pulse rounded-xl bg-neutral-100" />
      )}
    </div>
  );
}
