import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pushPayload, reminderEmail } from "./reminder-message";

describe("reminder messages", () => {
  it("builds a plain email and a push payload the service worker can show", () => {
    const email = reminderEmail({
      title: "תזכורת זיכוי — FOX",
      body: "₪50 · עוד 7 ימים",
      url: "https://justrefundme.netlify.app/vouchers/v-1",
    });
    assert.equal(email.subject, "תזכורת זיכוי — FOX");
    assert.match(email.text, /לזיכוי: https:\/\/justrefundme.netlify.app\/vouchers\/v-1/);

    const payload = JSON.parse(
      pushPayload({
        title: email.subject,
        body: "₪50",
        url: "https://justrefundme.netlify.app/vouchers/v-1",
        tag: "v-1:7",
      }),
    ) as { title: string; url: string; tag: string };
    assert.equal(payload.title, "תזכורת זיכוי — FOX");
    assert.equal(payload.tag, "v-1:7");
    assert.match(payload.url, /^https:\/\/justrefundme.netlify.app\//);
  });
});
