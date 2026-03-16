import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = request.cookies.get("discord_oauth_state")?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.json({ error: "OAuth state inválido." }, { status: 400 });
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${process.env.DISCORD_CLIENT_ID}:${process.env.DISCORD_CLIENT_SECRET}`).toString("base64"),
    },
    body: tokenBody.toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.json({ error: tokenData?.error || "Falha ao trocar código por token." }, { status: 400 });
  }

  const userRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userRes.json();

  if (!userRes.ok) {
    return NextResponse.json({ error: userData?.message || "Falha ao carregar usuário do Discord." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = NextResponse.redirect(new URL("/", appUrl));
  response.cookies.set("discord_user", JSON.stringify({
    id: userData.id,
    username: userData.username,
    global_name: userData.global_name ?? null,
    avatar: userData.avatar ?? null,
    email: userData.email ?? null,
  }), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7
  });
  response.cookies.delete("discord_oauth_state");
  return response;
}
