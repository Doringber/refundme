export type DocumentType =
  | "store_credit"
  | "gift_voucher"
  | "shopping_voucher"
  | "receipt";

export type VoucherStatus =
  | "active"
  | "partially_redeemed"
  | "fully_redeemed"
  | "expired"
  | "archived";

export type ExpiryConfidence = "confirmed" | "uncertain" | "missing";

export type BranchAcceptance = "verified" | "unverified" | "not_accepted";

export type UrgencyLevel = "none" | "upcoming" | "urgent" | "expired";

export interface Merchant {
  id: string;
  nameHe: string;
  slug: string;
  category: string | null;
  website: string | null;
  logoColor: string | null;
}

export interface MerchantBranch {
  id: string;
  merchantId: string;
  nameHe: string;
  city: string;
  addressHe: string;
  lat: number | null;
  lng: number | null;
  acceptance: BranchAcceptance;
  notesHe: string | null;
  merchantNameHe?: string;
}

export interface Voucher {
  id: string;
  userId: string;
  merchantId: string | null;
  merchantName: string;
  documentType: DocumentType;
  status: VoucherStatus;
  /** Amounts stored in agorot (1 ILS = 100 agorot) */
  originalAmountAgorot: number;
  remainingAmountAgorot: number;
  currency: string;
  issueDate: string | null;
  expiryDate: string | null;
  expiryConfidence: ExpiryConfidence;
  voucherCode: string | null;
  barcodeValue: string | null;
  usageTerms: string | null;
  notes: string | null;
  documentPath: string | null;
  documentMimeType: string | null;
  documentFileName: string | null;
  /** Demo / local preview of uploaded file as data URL */
  documentDataUrl: string | null;
  extractionRaw: Record<string, unknown> | null;
  fieldsConfirmed: boolean;
  /** Shared with the owner's household. Omitted means not shared. */
  shared?: boolean;
  /** Display name of the owner when this voucher belongs to someone else. */
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Redemption {
  id: string;
  voucherId: string;
  userId: string;
  amountAgorot: number;
  redeemedAt: string;
  note: string | null;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  voucherId: string | null;
  kind: string;
  summaryHe: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** Personal display scale for Credit Orb liquid, in agorot */
  orbScaleAgorot: number | null;
  reminderDays: number[];
  /** Email fallback when this person has no Web Push subscription. */
  emailReminders: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractedFields {
  merchantName: string | null;
  documentType: DocumentType | null;
  amountAgorot: number | null;
  issueDate: string | null;
  expiryDate: string | null;
  voucherCode: string | null;
  barcodeValue: string | null;
  usageTerms: string | null;
  confidence: "high" | "low" | "none";
  notes: string | null;
}

export interface VoucherFilters {
  query?: string;
  merchant?: string;
  documentType?: DocumentType | "all";
  status?: VoucherStatus | "all";
  expiryBefore?: string;
  expiryAfter?: string;
}

export type HouseholdRole = "owner" | "member";

export interface HouseholdMemberView {
  userId: string;
  role: HouseholdRole;
  displayName: string | null;
  email: string | null;
}

export interface HouseholdInviteView {
  id: string;
  email: string | null;
  expiresAt: string;
}

export interface HouseholdSnapshot {
  id: string;
  name: string;
  role: HouseholdRole;
  members: HouseholdMemberView[];
  invites: HouseholdInviteView[];
}

export interface DashboardSummary {
  totalActiveCreditAgorot: number;
  nearestExpiring: Voucher | null;
  daysUntilNearestExpiry: number | null;
  merchantBreakdown: Array<{
    merchantName: string;
    totalAgorot: number;
    count: number;
  }>;
  expiringSoon: Voucher[];
  recentActivity: ActivityEvent[];
  vouchers: Voucher[];
}
