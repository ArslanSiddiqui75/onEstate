const GROUND = 448;

function house(x: number, width: number, eaves: number, rise: number, chimney = false) {
  const mid = x + width / 2;
  const peak = eaves - rise;
  let d = `M${x} ${GROUND}V${eaves}L${mid} ${peak}L${x + width} ${eaves}V${GROUND}`;
  if (chimney) {
    const cx = x + width * 0.3;
    const cy = eaves - rise * 0.42;
    d += `M${cx} ${cy}v-15h6.5v15`;
  }
  return d;
}

function block(x: number, width: number, top: number, cornice = false) {
  let d = `M${x} ${GROUND}V${top}H${x + width}V${GROUND}`;
  if (cornice) d += `M${x - 5} ${top + 9}H${x + width + 5}`;
  return d;
}

function spire(x: number, width: number, shoulder: number, tip: number) {
  const mid = x + width / 2;
  return `M${x} ${GROUND}V${shoulder}L${mid} ${tip + 26}L${x + width} ${shoulder}V${GROUND}M${mid} ${tip + 26}V${tip}`;
}

/** Stepped tower, widest at the street. Tiers are [width, topY] from the base upward. */
function tower(x: number, tiers: Array<[number, number]>, mast = 0) {
  const base = tiers[0][0];
  const cx = x + base / 2;
  const left: Array<[number, number]> = [[x, GROUND]];
  const right: Array<[number, number]> = [[x + base, GROUND]];
  for (let i = 0; i < tiers.length; i++) {
    const [width, top] = tiers[i];
    const next = tiers[i + 1];
    left.push([cx - width / 2, top]);
    right.push([cx + width / 2, top]);
    if (next) {
      left.push([cx - next[0] / 2, top]);
      right.push([cx + next[0] / 2, top]);
    }
  }
  const tip = tiers[tiers.length - 1][1];
  const outline = [...left, ...right.reverse()]
    .map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`)
    .join("");
  return mast ? `${outline}M${cx} ${tip}V${tip - mast}` : outline;
}

const NEAR = [
  tower(8, [
    [86, 300],
    [62, 168],
    [40, 78],
  ], 22),
  house(112, 70, 372, 38, true),
  house(186, 70, 386, 34),
  block(286, 128, 248, true),
  block(440, 168, 404),
  house(636, 74, 378, 36, true),
  spire(738, 72, 332, 196),
  block(842, 150, 276, true),
  house(1024, 68, 384, 32),
  house(1096, 68, 368, 36, true),
  tower(1196, [
    [78, 292],
    [54, 150],
    [34, 64],
  ], 18),
  house(1292, 66, 360, 34, true),
  block(1372, 78, 214, true),
];

export function LoginCityline() {
  return (
    <svg
      className="login-cityline"
      viewBox="0 0 1440 460"
      preserveAspectRatio="xMidYMax meet"
      fill="none"
      aria-hidden
    >
      <g className="login-cityline-near" stroke="currentColor" strokeLinejoin="round" strokeLinecap="round">
        <path d={`M0 ${GROUND}H1440`} />
        {NEAR.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
