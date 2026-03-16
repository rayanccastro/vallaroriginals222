import { NextResponse } from "next/server";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = NextResponse.redirect(new URL("/", appUrl));
  response.cookies.delete("discord_user");
  response.cookies.delete("discord_oauth_state");
  return response;
}
