import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Voucher } from "@/lib/types";
import { DEFAULT_REMINDER_DAYS, normalizeReminderDays } from "./reminder-days";
import {
  addDaysIso,
  jerusalemDateIso,
  planExpiryReminders,
  preferredReminderChannel,
  reminderDedupeKey,
  type ReminderPerson,
} from "./reminder-plan";

function voucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "v-1",
    userId: "owner",
    merchantId: null,
    merchantName: "FOX",
    documentType: "store_credit",
    status: "active",
    originalAmountAgorot: 10000,
    remainingAmountAgorot: 5000,
    currency: "ILS",
    issueDate: "2026-01-01",
    expiryDate: "2026-07-01",
    expiryConfidence: "confirmed",
    voucherCode: null,
    barcodeValue: null,
    usageTerms: null,
    notes: null,
    documentPath: null,
    documentMimeType: null,
    documentFileName: null,
    documentDataUrl: null,
    extractionRaw: null,
    fieldsConfirmed: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    shared: false,
    ...overrides,
  };
}

function person(overrides: Partial<ReminderPerson> = {}): ReminderPerson {
  return {
    userId: "owner",
    reminderDays: [...DEFAULT_REMINDER_DAYS],
    email: "owner@example.com",
    emailReminders: true,
    hasPush: false,
    ...overrides,
  };
}

describe("reminder defaults", () => {
  it("uses 30, 7 and 1 days and drops invalid values", () => {
    assert.deepEqual([...DEFAULT_REMINDER_DAYS], [30, 7, 1]);
    assert.deepEqual(normalizeReminderDays([1, 30, 7, 7, 0, -3, 400]), [30, 7, 1]);
    assert.deepEqual(normalizeReminderDays([]), [30, 7, 1]);
  });
});

describe("jerusalem calendar", () => {
  it("rolls the date at midnight in Asia/Jerusalem", () => {
    assert.equal(jerusalemDateIso(new Date("2026-06-15T20:30:00Z")), "2026-06-15");
    assert.equal(jerusalemDateIso(new Date("2026-06-15T21:30:00Z")), "2026-06-16");
    assert.equal(addDaysIso("2026-06-16", 30), "2026-07-16");
  });
});

describe("planExpiryReminders", () => {
  const today = new Date("2026-06-01T12:00:00");

  it("notifies at 30, 7 and 1 days, and prefers push over email", () => {
    assert.equal(preferredReminderChannel(person({ hasPush: true })), "push");
    assert.equal(preferredReminderChannel(person({ hasPush: false })), "email");
    assert.equal(
      preferredReminderChannel(person({ hasPush: false, emailReminders: false })),
      null,
    );

    const at30 = planExpiryReminders({
      vouchers: [voucher({ expiryDate: "2026-07-01" })],
      people: [person({ hasPush: true })],
      households: [],
      alreadySent: new Set(),
      today,
    });
    assert.equal(at30.length, 1);
    assert.equal(at30[0].threshold, 30);
    assert.equal(at30[0].channel, "push");
    assert.equal(at30[0].daysLeft, 30);

    const insideWindow = planExpiryReminders({
      vouchers: [voucher({ expiryDate: "2026-06-20" })],
      people: [person()],
      households: [],
      alreadySent: new Set([reminderDedupeKey("owner", "v-1", 30)]),
      today,
    });
    assert.equal(insideWindow.length, 0);

    const at7 = planExpiryReminders({
      vouchers: [voucher({ expiryDate: "2026-06-08" })],
      people: [person()],
      households: [{ memberIds: ["owner", "partner"] }],
      alreadySent: new Set(),
      today,
    });
    assert.equal(at7.length, 1);
    assert.equal(at7[0].threshold, 7);

    const at1 = planExpiryReminders({
      vouchers: [voucher({ expiryDate: "2026-06-02" })],
      people: [person({ hasPush: false })],
      households: [],
      alreadySent: new Set(),
      today,
    });
    assert.equal(at1.length, 1);
    assert.equal(at1[0].threshold, 1);
    assert.equal(at1[0].channel, "email");
  });

  it("tells a household member only when the voucher is shared", () => {
    const people = [
      person({ hasPush: true }),
      person({
        userId: "partner",
        email: "partner@example.com",
        hasPush: false,
        reminderDays: [7],
      }),
    ];
    const households = [{ memberIds: ["owner", "partner"] }];

    const hidden = planExpiryReminders({
      vouchers: [voucher({ expiryDate: "2026-06-08", shared: false })],
      people,
      households,
      alreadySent: new Set(),
      today,
    });
    assert.deepEqual(hidden.map((item) => item.userId), ["owner"]);

    const shared = planExpiryReminders({
      vouchers: [voucher({ expiryDate: "2026-06-08", shared: true })],
      people,
      households,
      alreadySent: new Set(),
      today,
    });
    assert.deepEqual(
      shared.map((item) => item.userId).sort(),
      ["owner", "partner"],
    );
    assert.equal(shared.find((item) => item.userId === "partner")?.channel, "email");
  });

  it("skips email when push is missing and the person turned email off", () => {
    const planned = planExpiryReminders({
      vouchers: [voucher({ expiryDate: "2026-06-02" })],
      people: [person({ hasPush: false, emailReminders: false, email: "a@b.co" })],
      households: [],
      alreadySent: new Set(),
      today,
    });
    assert.equal(planned.length, 0);
  });
});
