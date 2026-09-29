import type {
  ActivityEvent,
  Merchant,
  MerchantBranch,
  Redemption,
  UserProfile,
  Voucher,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function mapVoucher(row: any): Voucher {
  return {
    id: row.id,
    userId: row.user_id,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    documentType: row.document_type,
    status: row.status,
    originalAmountAgorot: row.original_amount_agorot,
    remainingAmountAgorot: row.remaining_amount_agorot,
    currency: row.currency,
    issueDate: row.issue_date,
    expiryDate: row.expiry_date,
    expiryConfidence: row.expiry_confidence,
    voucherCode: row.voucher_code,
    barcodeValue: row.barcode_value,
    usageTerms: row.usage_terms,
    notes: row.notes,
    documentPath: row.document_path,
    documentMimeType: row.document_mime_type,
    documentFileName: row.document_file_name,
    documentDataUrl: null,
    extractionRaw: row.extraction_raw,
    fieldsConfirmed: row.fields_confirmed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRedemption(row: any): Redemption {
  return {
    id: row.id,
    voucherId: row.voucher_id,
    userId: row.user_id,
    amountAgorot: row.amount_agorot,
    redeemedAt: row.redeemed_at,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function mapActivity(row: any): ActivityEvent {
  return {
    id: row.id,
    userId: row.user_id,
    voucherId: row.voucher_id,
    kind: row.kind,
    summaryHe: row.summary_he,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export function mapProfile(row: any): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email ?? null,
    avatarUrl: row.avatar_url ?? null,
    orbScaleAgorot: row.orb_scale_agorot,
    reminderDays: row.reminder_days ?? [30, 14, 7, 3, 1],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapMerchant(row: any): Merchant {
  return {
    id: row.id,
    nameHe: row.name_he,
    slug: row.slug,
    category: row.category,
    website: row.website,
    logoColor: row.logo_color,
  };
}

export function mapBranch(row: any): MerchantBranch {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    nameHe: row.name_he,
    city: row.city,
    addressHe: row.address_he,
    lat: row.lat,
    lng: row.lng,
    acceptance: row.acceptance,
    notesHe: row.notes_he,
    merchantNameHe: row.merchants?.name_he,
  };
}
