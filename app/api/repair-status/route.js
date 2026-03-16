import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

function getCooldownRemainingMs(rows) {
  if (!rows.length || rows.length < 3) return 0;
  const oldest = Math.min(...rows.map((row) => new Date(row.created_at).getTime()));
  return Math.max(0, oldest + DAY_MS - Date.now());
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    if (!customerId) return NextResponse.json({ repairLast24h: 0, cooldownRemainingMs: 0 });

    const rows = await sql`
      select id, created_at
      from sales
      where customer_id = ${customerId}
        and created_at >= date_trunc('day', now())
        and exists (
          select 1
          from jsonb_array_elements(sales.items) as item
          where item ->> 'id' = 'repair-kit'
            and coalesce((item ->> 'quantity')::int, 0) > 0
        )
      order by created_at asc
    `;

    return NextResponse.json({
      repairLast24h: rows.length,
      cooldownRemainingMs: getCooldownRemainingMs(rows),
    });
  } catch {
    return NextResponse.json({ error: "Erro ao consultar status." }, { status: 500 });
  }
}
