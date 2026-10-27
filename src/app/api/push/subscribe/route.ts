import { NextResponse } from "next/server";
import { logServerError } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type PushBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

function validSubscription(body: PushBody): body is {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  return Boolean(
    body.endpoint &&
      body.endpoint.startsWith("https://") &&
      body.endpoint.length <= 2000 &&
      body.keys?.p256dh &&
      body.keys.p256dh.length <= 200 &&
      body.keys.auth &&
      body.keys.auth.length <= 200,
  );
}

async function userClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function POST(request: Request) {
  let body: PushBody;
  try {
    body = (await request.json()) as PushBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!validSubscription(body)) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  try {
    const { supabase, user } = await userClient();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth_key: body.keys.auth,
        user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) {
      logServerError("push-subscribe", error.message);
      if (/does not exist|schema cache|Could not find the/i.test(error.message)) {
        return NextResponse.json({ error: "migration_required" }, { status: 503 });
      }
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("push-subscribe", error);
    return NextResponse.json({ error: "unavailable" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  let endpoint = "";
  try {
    const body = (await request.json()) as { endpoint?: string };
    endpoint = body.endpoint ?? "";
  } catch {
    endpoint = "";
  }
  if (!endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  try {
    const { supabase, user } = await userClient();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", endpoint);
    if (error) {
      logServerError("push-unsubscribe", error.message);
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    logServerError("push-unsubscribe", error);
    return NextResponse.json({ error: "unavailable" }, { status: 400 });
  }
}
