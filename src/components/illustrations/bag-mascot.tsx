/**
 * Lightweight inline mascot: a bag of forgotten store credits.
 * Bold outline, saturated fills — the same language as the mifal reference.
 */

type Mood = "happy" | "empty" | "walk";

export function BagMascot({
  className = "",
  mood = "happy",
  title = "שקית זיכויים",
}: {
  className?: string;
  mood?: Mood;
  title?: string;
}) {
  const blinking = mood !== "empty";
  return (
    <svg
      viewBox="0 0 220 200"
      className={`mascot-bob ${className}`}
      role="img"
      aria-label={title}
    >
      <ellipse cx="110" cy="184" rx="54" ry="8" fill="#1c1c1c" opacity="0.12" />
      <g className={mood === "walk" ? "mascot-walk" : undefined}>
        <path
          d="M58 78c0-22 16-36 52-36s52 14 52 36v78c0 16-14 26-52 26S58 172 58 156V78z"
          fill="#2f6bff"
          stroke="#1c1c1c"
          strokeWidth="4"
        />
        <path
          d="M78 46c6-16 16-24 32-24s26 8 32 24"
          fill="none"
          stroke="#1c1c1c"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M96 28c2-10 8-16 14-16s12 6 14 16"
          fill="none"
          stroke="#1c1c1c"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <rect
          x="86"
          y="62"
          width="48"
          height="58"
          rx="8"
          fill="#ffe08a"
          stroke="#1c1c1c"
          strokeWidth="3.5"
          className="ticket-float"
        />
        <path d="M94 78h32M94 90h24M94 102h28" stroke="#1c1c1c" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="92" cy="128" r="7" fill="#fffdf8" stroke="#1c1c1c" strokeWidth="3" />
        <circle cx="128" cy="128" r="7" fill="#fffdf8" stroke="#1c1c1c" strokeWidth="3" />
        {blinking ? (
          <>
            <circle cx="92" cy="129" r="3" fill="#1c1c1c" className="mascot-blink" />
            <circle cx="128" cy="129" r="3" fill="#1c1c1c" className="mascot-blink" />
          </>
        ) : (
          <>
            <path d="M86 128h12M122 128h12" stroke="#1c1c1c" strokeWidth="3" strokeLinecap="round" />
          </>
        )}
        <path
          d={mood === "empty" ? "M98 150h24" : "M96 148c8 10 20 10 28 0"}
          fill="none"
          stroke="#1c1c1c"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="74" cy="142" r="6" fill="#f07a5a" />
        <circle cx="146" cy="142" r="6" fill="#f07a5a" />
        <path
          d="M46 110c-10 2-16 12-14 22"
          fill="none"
          stroke="#1c1c1c"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M174 110c10 2 16 12 14 22"
          fill="none"
          stroke="#1c1c1c"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </g>
      {mood === "happy" && (
        <g className="sparkle" fill="#f5c518" stroke="#1c1c1c" strokeWidth="1.5">
          <path d="M178 42l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
          <path d="M40 58l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </g>
      )}
    </svg>
  );
}

export function TicketSlip({
  amount,
  caption,
  className = "",
}: {
  amount: string;
  caption: string;
  className?: string;
}) {
  return (
    <div className={`ticket-slip ${className}`}>
      <p className="text-xs font-extrabold tracking-wide text-[#5c564c]">בשקית</p>
      <p className="font-display mt-1 text-3xl leading-none text-[#1c1c1c]">{amount}</p>
      <p className="mt-2 text-xs font-bold text-[#5c564c]">{caption}</p>
    </div>
  );
}
