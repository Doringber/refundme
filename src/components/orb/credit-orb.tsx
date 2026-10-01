"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  expiryMessage,
  expiryUrgency,
  formatIls,
} from "@/lib/calculations";
import type { Voucher } from "@/lib/types";

export interface CreditOrbProps {
  totalAgorot: number;
  nearestExpiring: Voucher | null;
  daysUntilNearestExpiry: number | null;
  /** Personal display scale in agorot; liquid is decorative until set */
  orbScaleAgorot: number | null;
  /** Briefly animate a credit gain (agorot) */
  gainAgorot?: number | null;
  onGainShown?: () => void;
  emptyHref?: string;
  className?: string;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setReduced(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useCountUp(target: number, durationMs: number, enabled: boolean) {
  const [value, setValue] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    if (!enabled) {
      prev.current = target;
      const id = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(id);
    }
    if (prev.current === target) return;
    const from = prev.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
      else prev.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, enabled]);

  return enabled ? value : target;
}

function useAnimatedFill(fillRatio: number, enabled: boolean) {
  const [animatedFill, setAnimatedFill] = useState(fillRatio);
  const fromRef = useRef(fillRatio);

  useEffect(() => {
    if (!enabled) {
      fromRef.current = fillRatio;
      const id = requestAnimationFrame(() => setAnimatedFill(fillRatio));
      return () => cancelAnimationFrame(id);
    }
    const from = fromRef.current;
    const begin = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - begin) / 900);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (fillRatio - from) * eased;
      setAnimatedFill(next);
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = fillRatio;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [fillRatio, enabled]);

  return enabled ? animatedFill : fillRatio;
}

export function CreditOrb({
  totalAgorot,
  nearestExpiring,
  daysUntilNearestExpiry,
  orbScaleAgorot,
  gainAgorot = null,
  onGainShown,
  emptyHref = "/vouchers/new",
  className = "",
}: CreditOrbProps) {
  const uid = useId();
  const reducedMotion = usePrefersReducedMotion();
  const displayTotal = useCountUp(totalAgorot, 900, !reducedMotion);
  const [gainFlash, setGainFlash] = useState<number | null>(null);

  useEffect(() => {
    if (!gainAgorot || gainAgorot <= 0) return;
    const showId = requestAnimationFrame(() => setGainFlash(gainAgorot));
    const t = window.setTimeout(
      () => {
        setGainFlash(null);
        onGainShown?.();
      },
      reducedMotion ? 50 : 1100,
    );
    return () => {
      cancelAnimationFrame(showId);
      window.clearTimeout(t);
    };
  }, [gainAgorot, onGainShown, reducedMotion]);

  const urgency = expiryUrgency(
    nearestExpiring?.expiryDate ?? null,
    nearestExpiring?.expiryConfidence ?? "missing",
  );

  const ringColor =
    urgency === "urgent" || urgency === "expired"
      ? "var(--blush-deep)"
      : urgency === "upcoming"
        ? "var(--lime-chip)"
        : "var(--forest)";

  const hasConfirmedCountdown =
    nearestExpiring?.expiryConfidence === "confirmed" &&
    nearestExpiring.expiryDate &&
    daysUntilNearestExpiry !== null;

  const ringProgress = useMemo(() => {
    if (!hasConfirmedCountdown || daysUntilNearestExpiry === null) return 0;
    if (daysUntilNearestExpiry < 0) return 1;
    return Math.max(0, Math.min(1, 1 - daysUntilNearestExpiry / 30));
  }, [hasConfirmedCountdown, daysUntilNearestExpiry]);

  const fillRatio = useMemo(() => {
    if (!orbScaleAgorot || orbScaleAgorot <= 0) return 0.42;
    return Math.max(0.08, Math.min(0.92, totalAgorot / orbScaleAgorot));
  }, [orbScaleAgorot, totalAgorot]);

  const animatedFill = useAnimatedFill(fillRatio, !reducedMotion);

  const message = expiryMessage(nearestExpiring, daysUntilNearestExpiry);
  const size = 280;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ringProgress);
  const waveY = size * (1 - animatedFill);

  const isEmpty = totalAgorot === 0 && !nearestExpiring;

  const scaleLabel =
    orbScaleAgorot && orbScaleAgorot > 0
      ? `מתוך ${formatIls(orbScaleAgorot)}`
      : null;

  return (
    <section
      className={`relative mx-auto flex w-full max-w-md flex-col items-center ${className}`}
      aria-label={
        isEmpty
          ? "אין זיכויים זמינים"
          : `זיכויים זמינים ${formatIls(totalAgorot)}. ${message}`
      }
    >
      <Link
        href={isEmpty ? emptyHref : "/vouchers?status=active"}
        className="group relative block rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[color-mix(in_srgb,var(--pool)_35%,transparent)]"
        aria-label={
          isEmpty
            ? "הוספת זיכוי ראשון"
            : `פתיחת זיכויים פעילים. סה״כ ${formatIls(totalAgorot)}`
        }
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="drop-shadow-lg"
          role="img"
        >
          <title>
            {isEmpty
              ? "אין זיכויים זמינים"
              : `זיכויים זמינים ${formatIls(totalAgorot)}`}
          </title>
          <defs>
            <clipPath id={`${uid}-clip`}>
              <circle cx={size / 2} cy={size / 2} r={radius - 6} />
            </clipPath>
            <linearGradient id={`${uid}-liquid`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--orb-liquid-1, #47B5A8)" />
              <stop offset="55%" stopColor="var(--orb-liquid-2, #6EC4BA)" />
              <stop offset="100%" stopColor="var(--orb-liquid-3, #A3C1E2)" />
            </linearGradient>
            <linearGradient id={`${uid}-highlight`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--orb-highlight, #DBC0E8)"
                stopOpacity="0.55"
              />
              <stop
                offset="100%"
                stopColor="var(--orb-liquid-1, #47B5A8)"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="var(--orb-surface, #ffffff)"
            stroke="var(--ring-track)"
            strokeWidth={stroke}
          />

          {!isEmpty && hasConfirmedCountdown && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{
                transition: reducedMotion ? undefined : "stroke-dashoffset 0.9s ease",
              }}
            />
          )}

          <g clipPath={`url(#${uid}-clip)`}>
            <rect
              x={0}
              y={isEmpty ? size * 0.72 : waveY}
              width={size}
              height={size}
              fill={`url(#${uid}-liquid)`}
              opacity={isEmpty ? 0.55 : 1}
            />
            {!reducedMotion && (
              <g style={{ animation: "orb-wave 4s linear infinite" }}>
                <path
                  d={`M0 ${(isEmpty ? size * 0.72 : waveY) + 8} Q ${size / 4} ${(isEmpty ? size * 0.72 : waveY) - 6}, ${size / 2} ${(isEmpty ? size * 0.72 : waveY) + 8} T ${size} ${(isEmpty ? size * 0.72 : waveY) + 8} V ${size} H 0 Z`}
                  fill={`url(#${uid}-highlight)`}
                  opacity={0.85}
                />
                <path
                  d={`M${size} ${(isEmpty ? size * 0.72 : waveY) + 8} Q ${(size * 5) / 4} ${(isEmpty ? size * 0.72 : waveY) - 6}, ${size * 1.5} ${(isEmpty ? size * 0.72 : waveY) + 8} T ${size * 2} ${(isEmpty ? size * 0.72 : waveY) + 8} V ${size} H ${size} Z`}
                  fill={`url(#${uid}-highlight)`}
                  opacity={0.85}
                />
              </g>
            )}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius - 6}
              fill={`url(#${uid}-highlight)`}
              opacity={0.25}
            />
          </g>

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius - 6}
            fill="none"
            stroke="var(--orb-rim, rgba(255,255,255,0.55))"
            strokeWidth={2}
          />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-semibold text-[color:var(--orb-ink-muted,#2f4f3acc)]">
            זיכויים זמינים
          </p>
          <p className="font-display mt-1 text-5xl tracking-tight text-[color:var(--orb-ink,#2f4f3a)]">
            {formatIls(displayTotal)}
          </p>
          <p className="mt-1 text-xs font-medium text-[color:var(--orb-ink-soft,#5d7564)]">
            יתרה לפי הדיווח שלך
          </p>
          {scaleLabel ? (
            <p className="mt-1 text-xs text-[color:var(--orb-ink-faint,#2f4f3a8c)]">
              {scaleLabel}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[color:var(--orb-ink-faint,#2f4f3a66)]">
              {isEmpty ? "צלמו שובר להתחלה" : "גלים לנוי — ללא אחוזים"}
            </p>
          )}
        </div>

        {gainFlash != null && gainFlash > 0 && (
          <div
            className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 font-display text-2xl text-[color:var(--orb-ink,#2f4f3a)]"
            style={{
              animation: reducedMotion ? undefined : "count-pop 1s ease forwards",
            }}
            aria-live="polite"
          >
            +{formatIls(gainFlash)}
          </div>
        )}
      </Link>

      {isEmpty ? (
        <p className="mt-5 text-center text-sm text-eggplant">
          צלמו שובר — והיתרה תופיע בעיגול
        </p>
      ) : nearestExpiring && hasConfirmedCountdown ? (
        <Link
          href={`/vouchers/${nearestExpiring.id}`}
          className="mt-5 max-w-sm rounded-2xl px-4 py-3 text-center text-sm font-semibold transition hover:brightness-95"
          style={{
            background:
              urgency === "urgent" || urgency === "expired"
                ? "rgba(247,111,84,0.16)"
                : urgency === "upcoming"
                  ? "rgba(247,226,137,0.55)"
                  : "rgba(71,181,168,0.14)",
            color: "var(--orb-chip-ink, var(--night))",
          }}
          aria-label={`${message}. תאריך: ${nearestExpiring.expiryDate}`}
        >
          {message}
          <span className="mt-1 block text-xs font-medium opacity-80">
            תאריך: {nearestExpiring.expiryDate}
          </span>
        </Link>
      ) : nearestExpiring ? (
        <Link
          href={`/vouchers/${nearestExpiring.id}`}
          className="mt-5 max-w-sm rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-semibold text-[color:var(--orb-chip-ink,var(--night))]"
        >
          תוקף לא אומת — בדקו את המסמך
        </Link>
      ) : (
        <p className="mt-5 text-center text-sm text-eggplant">{message}</p>
      )}
    </section>
  );
}
