import { NextResponse } from "next/server";

export async function GET(request) {
  const raw = request.cookies.get("discord_user")?.value;
  if (!raw) return NextResponse.json({ user: null });
  try {
    return NextResponse.json({ user: JSON.parse(raw) });
  } catch {
    return NextResponse.json({ user: null });
  }
}
