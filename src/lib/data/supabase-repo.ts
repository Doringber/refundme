"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ActivityEvent,
  Redemption,
  UserProfile,
  Voucher,
} from "@/lib/types";
import {
  mapActivity,
  mapProfile,
  mapRedemption,
  mapVoucher,
} from "@/lib/data/mappers";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function fetchProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<UserProfile>,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: patch.displayName,
      email: patch.email,
      avatar_url: patch.avatarUrl,
      orb_scale_agorot: patch.orbScaleAgorot,
      reminder_days: patch.reminderDays,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return mapProfile(data);
}

export async function fetchVouchers(
  supabase: SupabaseClient,
  userId: string,
): Promise<Voucher[]> {
  const { data, error } = await supabase
    .from("vouchers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapVoucher);
}

export async function fetchRedemptions(
  supabase: SupabaseClient,
  userId: string,
): Promise<Redemption[]> {
  const { data, error } = await supabase
    .from("redemptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRedemption);
}

export async function fetchActivity(
  supabase: SupabaseClient,
  userId: string,
): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from("activity_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(mapActivity);
}

export async function insertActivity(
  supabase: SupabaseClient,
  event: Omit<ActivityEvent, "id" | "createdAt"> & { id?: string },
): Promise<void> {
  const { error } = await supabase.from("activity_events").insert({
    id: event.id,
    user_id: event.userId,
    voucher_id: event.voucherId,
    kind: event.kind,
    summary_he: event.summaryHe,
    metadata: event.metadata,
  });
  if (error) throw error;
}

export async function createVoucher(
  supabase: SupabaseClient,
  voucher: Voucher,
): Promise<Voucher> {
  let documentPath = voucher.documentPath;

  if (voucher.documentDataUrl && voucher.documentFileName) {
    const blob = dataUrlToBlob(voucher.documentDataUrl);
    const path = `${voucher.userId}/${voucher.id}/${voucher.documentFileName}`;
    const { error: uploadError } = await supabase.storage
      .from("voucher-documents")
      .upload(path, blob, {
        contentType: voucher.documentMimeType ?? blob.type,
        upsert: true,
      });
    if (uploadError) throw uploadError;
    documentPath = path;
  }

  const { data, error } = await supabase
    .from("vouchers")
    .insert({
      id: voucher.id,
      user_id: voucher.userId,
      merchant_id: voucher.merchantId,
      merchant_name: voucher.merchantName,
      document_type: voucher.documentType,
      status: voucher.status,
      original_amount_agorot: voucher.originalAmountAgorot,
      remaining_amount_agorot: voucher.remainingAmountAgorot,
      currency: voucher.currency,
      issue_date: voucher.issueDate,
      expiry_date: voucher.expiryDate,
      expiry_confidence: voucher.expiryConfidence,
      voucher_code: voucher.voucherCode,
      barcode_value: voucher.barcodeValue,
      usage_terms: voucher.usageTerms,
      notes: voucher.notes,
      document_path: documentPath,
      document_mime_type: voucher.documentMimeType,
      document_file_name: voucher.documentFileName,
      extraction_raw: voucher.extractionRaw,
      fields_confirmed: voucher.fieldsConfirmed,
    })
    .select("*")
    .single();
  if (error) throw error;

  await insertActivity(supabase, {
    userId: voucher.userId,
    voucherId: voucher.id,
    kind: "created",
    summaryHe:
      voucher.documentType === "receipt"
        ? `נשמרה קבלה מ${voucher.merchantName} (לא נספרת כזיכוי)`
        : `נוסף מסמך מ${voucher.merchantName}`,
    metadata: { amountAgorot: voucher.remainingAmountAgorot },
  });

  return mapVoucher(data);
}

export async function deleteVoucher(
  supabase: SupabaseClient,
  userId: string,
  voucherId: string,
  documentPath: string | null,
): Promise<void> {
  if (documentPath) {
    await supabase.storage.from("voucher-documents").remove([documentPath]);
  }
  const { error } = await supabase
    .from("vouchers")
    .delete()
    .eq("id", voucherId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function addRedemption(
  supabase: SupabaseClient,
  userId: string,
  voucherId: string,
  amountAgorot: number,
  note: string | null,
  merchantName: string,
): Promise<void> {
  const { error } = await supabase.from("redemptions").insert({
    voucher_id: voucherId,
    user_id: userId,
    amount_agorot: amountAgorot,
    note,
  });
  if (error) throw error;

  await insertActivity(supabase, {
    userId,
    voucherId,
    kind: "redemption",
    summaryHe: `מימוש של ₪${(amountAgorot / 100).toLocaleString("he-IL")} ב${merchantName}`,
    metadata: { amountAgorot },
  });
}

export async function getDocumentSignedUrl(
  supabase: SupabaseClient,
  documentPath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("voucher-documents")
    .createSignedUrl(documentPath, 60 * 30);
  if (error) return null;
  return data.signedUrl;
}

export async function exportUserJson(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const [vouchers, redemptions, activity] = await Promise.all([
    fetchVouchers(supabase, userId),
    fetchRedemptions(supabase, userId),
    fetchActivity(supabase, userId),
  ]);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      balanceLabel: "יתרה לפי הדיווח שלך",
      userId,
      vouchers,
      redemptions,
      activity,
    },
    null,
    2,
  );
}
