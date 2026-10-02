import { readFileSync } from "node:fs";
import { createWorker } from "tesseract.js";
import { extractBuyMeGifts } from "../src/lib/extract-buyme";
import { vouchersFromBuyMeGifts } from "../src/lib/buyme-import";

async function main(): Promise<void> {
  const buf = readFileSync("/tmp/buyme-list.png");
  const worker = await createWorker("heb");
  const result = await worker.recognize(buf);
  await worker.terminate();
  const text = result.data.text ?? "";
  const gifts = extractBuyMeGifts(text);
  const { saved, skipped } = vouchersFromBuyMeGifts(gifts);
  console.log("--- OCR ---");
  console.log(text);
  console.log("--- PARSED ---");
  console.log(
    JSON.stringify(
      gifts.map((g) => ({ title: g.title, agorot: g.amountAgorot })),
      null,
      2,
    ),
  );
  console.log("--- VOUCHERS ---");
  console.log(
    JSON.stringify(
      saved.map((v) => ({
        merchant: v.merchantName,
        remainingAgorot: v.remainingAmountAgorot,
      })),
      null,
      2,
    ),
  );
  console.log(`saved=${saved.length} skipped=${skipped.length}`);
  if (saved.length < 1) process.exit(2);
}

void main();
