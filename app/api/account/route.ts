import { NextResponse } from "next/server";
import { createRequestClient } from "@/lib/supabase/request";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  const supabase = await createRequestClient(req);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const avatars = supabase.storage.from("avatars");
  const { data: files } = await avatars.list(user.id, { limit: 1000 });
  if (files?.length) {
    const { error } = await avatars.remove(files.map((f) => `${user.id}/${f.name}`));
    if (error) console.error("account delete avatars", error.message);
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    if (error.code === "42501") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("account delete", error.message);
    return NextResponse.json({ error: "Could not delete account." }, { status: 500 });
  }

  await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
