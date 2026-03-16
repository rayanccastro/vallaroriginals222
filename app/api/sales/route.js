import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

const DEFAULT_DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || "";
const DAY_MS = 24 * 60 * 60 * 1000;

function getCooldownRemainingMs(rows) {
  if (!rows.length || rows.length < 3) return 0;
  const oldest = Math.min(...rows.map((row) => new Date(row.created_at).getTime()));
  return Math.max(0, oldest + DAY_MS - Date.now());
}

async function sendDiscordLog(sale) {
  if (!DEFAULT_DISCORD_WEBHOOK) return;
  const description = (sale.items || []).map((item) => `• ${item.name} x${item.quantity}`).join("\n");
  await fetch(DEFAULT_DISCORD_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{
        title: "Nova venda",
        description,
        color: 14235273,
        fields: [
          { name: "Nome", value: sale.customer_name, inline: true },
          { name: "ID", value: sale.customer_id, inline: true },
          { name: "Mecânico", value: sale.mechanic_name, inline: true },
          { name: "ID do Mecânico", value: sale.mechanic_id, inline: true },
          { name: "Total", value: String(sale.total), inline: false },
        ],
      }],
    }),
  });
}

async function getRepairSalesToday(customerId) {
  return await sql`
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
}

export async function GET() {
  try {
    const sales = await sql`select id, customer_name, customer_id, mechanic_name, mechanic_id, items, total, created_at from sales order by created_at desc`;
    return NextResponse.json(sales);
  } catch {
    return NextResponse.json({ error: "Erro ao carregar vendas." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { customerName, customerId, mechanicName, mechanicId, items, total } = body;

    if (!customerName || !customerId || !mechanicName || !mechanicId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const hasRepair = items.some((item) => item.id === "repair-kit" && Number(item.quantity || 0) > 0);

    if (hasRepair) {
      const repairSalesToday = await getRepairSalesToday(customerId);
      if (repairSalesToday.length >= 3) {
        return NextResponse.json(
          {
            error: "Este ID já atingiu o limite diário de 3 vendas com Repair Kit.",
            repairLast24h: repairSalesToday.length,
            cooldownRemainingMs: getCooldownRemainingMs(repairSalesToday),
          },
          { status: 400 }
        );
      }
    }

    const inserted = await sql`
      insert into sales (customer_name, customer_id, mechanic_name, mechanic_id, items, total)
      values (${customerName}, ${customerId}, ${mechanicName}, ${mechanicId}, ${JSON.stringify(items)}, ${Number(total || 0)})
      returning *
    `;

    try { await sendDiscordLog(inserted[0]); } catch {}

    return NextResponse.json(inserted[0], { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erro interno ao registrar venda." }, { status: 500 });
  }
}
