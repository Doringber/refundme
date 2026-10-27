const BITS = [
  { x: "-86px", y: "-36px", r: "-48deg", color: "#2f6bff", delay: "0ms" },
  { x: "-48px", y: "-78px", r: "36deg", color: "#ffe08a", delay: "30ms" },
  { x: "0px", y: "-96px", r: "-18deg", color: "#f07a5a", delay: "60ms" },
  { x: "52px", y: "-74px", r: "42deg", color: "#2f6bff", delay: "20ms" },
  { x: "90px", y: "-28px", r: "-54deg", color: "#ffe08a", delay: "50ms" },
  { x: "-108px", y: "18px", r: "24deg", color: "#f6f1e4", delay: "80ms" },
  { x: "112px", y: "24px", r: "-30deg", color: "#f07a5a", delay: "40ms" },
  { x: "-24px", y: "72px", r: "70deg", color: "#2f6bff", delay: "90ms" },
  { x: "28px", y: "84px", r: "-66deg", color: "#ffe08a", delay: "70ms" },
  { x: "-64px", y: "48px", r: "16deg", color: "#1c1c1c", delay: "10ms" },
  { x: "70px", y: "52px", r: "-12deg", color: "#f6f1e4", delay: "100ms" },
  { x: "8px", y: "-48px", r: "88deg", color: "#f07a5a", delay: "15ms" },
] as const;

/** Short transform/opacity burst. Mount once per celebration. */
export function ConfettiBurst() {
  return (
    <div className="confetti-layer" aria-hidden="true">
      {BITS.map((bit) => (
        <span
          key={`${bit.x}-${bit.y}`}
          className="confetti-bit"
          style={{
            background: bit.color,
            animationDelay: bit.delay,
            ["--x" as string]: bit.x,
            ["--y" as string]: bit.y,
            ["--r" as string]: bit.r,
          }}
        />
      ))}
    </div>
  );
}
