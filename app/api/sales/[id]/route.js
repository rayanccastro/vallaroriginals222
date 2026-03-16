import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function DELETE(_request, { params }) {
  try {
    const deleted = await sql`delete from sales where id = ${params.id} returning id`;
    if (!deleted.length) return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erro ao excluir venda." }, { status: 500 });
  }
}
