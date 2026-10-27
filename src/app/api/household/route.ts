import { NextResponse } from "next/server";
import { householdErrorMessage } from "@/lib/household/api-errors";
import { createInviteToken, hashInviteToken, isInviteToken } from "@/lib/household/tokens";
import { siteOrigin } from "@/lib/http/site-origin";
import { logServerError } from "@/lib/log";
import { sendHouseholdInviteEmail } from "@/lib/notifications/email-reminder";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ActionBody = {
  action?: string;
  name?: string;
  email?: string;
  token?: string;
  userId?: string;
  inviteId?: string;
};

function jsonError(raw: string | undefined) {
  const mapped = householdErrorMessage(raw);
  return NextResponse.json(
    { error: mapped.error, message: mapped.message },
    { status: mapped.status },
  );
}

async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  try {
    const { supabase, user } = await sessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const membership = await supabase
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (membership.error) return jsonError(membership.error.message);
    if (!membership.data) return NextResponse.json({ household: null });

    const householdId = membership.data.household_id;
    const [householdRes, membersRes, profilesRes] = await Promise.all([
      supabase.from("households").select("id, name").eq("id", householdId).maybeSingle(),
      supabase
        .from("household_members")
        .select("user_id, role")
        .eq("household_id", householdId),
      supabase.from("profiles").select("id, display_name, email"),
    ]);
    if (householdRes.error) return jsonError(householdRes.error.message);
    if (membersRes.error) return jsonError(membersRes.error.message);

    const profiles = new Map(
      (profilesRes.data ?? []).map((row) => [
        row.id as string,
        {
          displayName: (row.display_name as string | null) ?? null,
          email: (row.email as string | null) ?? null,
        },
      ]),
    );

    let invites: Array<{ id: string; email: string | null; expiresAt: string }> = [];
    if (membership.data.role === "owner") {
      const admin = createAdminClient();
      if (admin) {
        const inviteRes = await admin
          .from("household_invites")
          .select("id, email, expires_at")
          .eq("household_id", householdId)
          .is("accepted_at", null)
          .gt("expires_at", new Date().toISOString());
        if (!inviteRes.error) {
          invites = (inviteRes.data ?? []).map((row) => ({
            id: row.id,
            email: row.email,
            expiresAt: row.expires_at,
          }));
        }
      }
    }

    return NextResponse.json({
      household: {
        id: householdRes.data?.id ?? householdId,
        name: householdRes.data?.name ?? "הבית",
        role: membership.data.role,
        members: (membersRes.data ?? []).map((row) => ({
          userId: row.user_id,
          role: row.role,
          displayName: profiles.get(row.user_id)?.displayName ?? null,
          email: profiles.get(row.user_id)?.email ?? null,
        })),
        invites,
      },
    });
  } catch (error) {
    logServerError("household", error);
    return NextResponse.json({ error: "unavailable" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  let body: ActionBody;
  try {
    body = (await request.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    const { user } = await sessionUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json(
        {
          error: "server_unconfigured",
          message: "חסר מפתח שרת של Supabase, אז אי אפשר לפתוח הזמנות.",
        },
        { status: 503 },
      );
    }

    if (body.action === "create") {
      const name = (body.name ?? "").trim().slice(0, 40);
      const { data, error } = await admin.rpc("service_create_household", {
        actor: user.id,
        household_name: name || "הבית",
      });
      if (error) return jsonError(error.message);
      return NextResponse.json({ ok: true, householdId: data });
    }

    if (body.action === "invite") {
      const token = createInviteToken();
      const email = (body.email ?? "").trim().toLowerCase();
      const { error } = await admin.rpc("service_create_household_invite", {
        actor: user.id,
        p_token_hash: hashInviteToken(token),
        invite_email: email || null,
      });
      if (error) return jsonError(error.message);

      const origin = siteOrigin(
        process.env.NEXT_PUBLIC_SITE_URL,
        new URL(request.url).origin,
      );
      const url = `${origin}/join/${token}`;
      let emailStatus: "sent" | "unconfigured" | "failed" | "skipped" = "skipped";
      if (email) {
        const household = await admin
          .from("household_members")
          .select("household_id, households(name)")
          .eq("user_id", user.id)
          .maybeSingle();
        const related = household.data?.households as
          | { name?: string }
          | { name?: string }[]
          | null;
        const householdName = Array.isArray(related)
          ? related[0]?.name
          : related?.name;
        const sent = await sendHouseholdInviteEmail({
          to: email,
          url,
          householdName: householdName || "הבית",
        });
        emailStatus = sent.ok ? "sent" : sent.reason === "email_unconfigured" ? "unconfigured" : "failed";
      }
      return NextResponse.json({ ok: true, url, emailStatus });
    }

    if (body.action === "accept") {
      const token = body.token ?? "";
      if (!isInviteToken(token)) {
        return jsonError("invalid_invite");
      }
      const { data, error } = await admin.rpc("service_accept_household_invite", {
        p_token_hash: hashInviteToken(token),
        joiner: user.id,
      });
      if (error) return jsonError(error.message);
      return NextResponse.json({ ok: true, householdId: data });
    }

    if (body.action === "leave") {
      const { error } = await admin.rpc("service_leave_household", { actor: user.id });
      if (error) return jsonError(error.message);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "remove-member") {
      if (!body.userId || !UUID.test(body.userId)) {
        return jsonError("member_not_found");
      }
      const { error } = await admin.rpc("service_remove_household_member", {
        actor: user.id,
        member: body.userId,
      });
      if (error) return jsonError(error.message);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "revoke-invite") {
      if (!body.inviteId || !UUID.test(body.inviteId)) {
        return jsonError("invite_not_found");
      }
      const { error } = await admin.rpc("service_revoke_household_invite", {
        actor: user.id,
        invite: body.inviteId,
      });
      if (error) return jsonError(error.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  } catch (error) {
    logServerError("household", error);
    return NextResponse.json({ error: "unavailable" }, { status: 400 });
  }
}
