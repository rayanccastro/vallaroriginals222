"use client";

import { useEffect, useMemo, useState } from "react";

const ITEM_CATALOG = [
  { id: "repair-kit", name: "Repair Kit", price: 950, icon: "🧰" },
  { id: "cleaning-kit", name: "Cleaning Kit", price: 350, icon: "🧴" },
];

const colors = {
  card: "rgba(13,13,13,0.92)",
  panel: "rgba(22,22,22,0.95)",
  border: "rgba(255,255,255,0.08)",
  gold: "#e8d089",
  goldSoft: "rgba(232,208,137,0.22)",
  red: "#d73a3a",
  redSoft: "rgba(215,58,58,0.18)",
  text: "#f5f5f5",
  muted: "#a1a1aa",
  whiteSoft: "rgba(255,255,255,0.06)",
};

const currency = (value) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(Number(value || 0));

function createInitialSelection() {
  return ITEM_CATALOG.reduce((acc, item) => {
    acc[item.id] = { selected: false, quantity: 0 };
    return acc;
  }, {});
}

function formatRemainingTime(ms) {
  if (ms <= 0) return "00:00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function StatCard({ label, value, accent = colors.gold }) {
  return (
    <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))", border: `1px solid ${colors.border}`, borderLeft: `4px solid ${accent}`, borderRadius: 18, padding: 18 }}>
      <div style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>{label}</div>
      <div style={{ color: colors.text, fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function inputStyle(textAlign = "left") {
  return {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${colors.border}`,
    background: colors.panel,
    color: colors.text,
    borderRadius: 16,
    padding: "14px 16px",
    outline: "none",
    textAlign,
    fontSize: 15,
  };
}

export default function Page() {
  const [discordUser, setDiscordUser] = useState(null);
  const [form, setForm] = useState({ customerName: "", customerId: "", mechanicName: "", mechanicId: "" });
  const [items, setItems] = useState(() => createInitialSelection());
  const [sales, setSales] = useState([]);
  const [status, setStatus] = useState("");
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [repairLast24h, setRepairLast24h] = useState(0);
  const [isLoadingSales, setIsLoadingSales] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadMe = async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await response.json();
      setDiscordUser(data?.user || null);
      if (data?.user) {
        setForm((prev) => ({
          ...prev,
          mechanicName: prev.mechanicName || data.user.global_name || data.user.username || "",
          mechanicId: prev.mechanicId || data.user.id || "",
        }));
      }
    } catch {
      setDiscordUser(null);
    }
  };

  const loadSales = async () => {
    try {
      setIsLoadingSales(true);
      const response = await fetch("/api/sales", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Falha ao carregar vendas.");
      setSales(Array.isArray(data) ? data : []);
    } catch (error) {
      setStatus(error.message || "Falha ao carregar vendas.");
    } finally {
      setIsLoadingSales(false);
    }
  };

  const loadRepairStatus = async (customerId) => {
    if (!customerId) {
      setRepairLast24h(0);
      setCooldownRemainingMs(0);
      return;
    }
    try {
      const response = await fetch(`/api/repair-status?customerId=${encodeURIComponent(customerId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Falha ao consultar limite.");
      setRepairLast24h(Number(data?.repairLast24h || 0));
      setCooldownRemainingMs(Number(data?.cooldownRemainingMs || 0));
    } catch {
      setRepairLast24h(0);
      setCooldownRemainingMs(0);
    }
  };

  useEffect(() => {
    loadMe();
    loadSales();
  }, []);

  useEffect(() => {
    if (!form.customerId) {
      setRepairLast24h(0);
      setCooldownRemainingMs(0);
      return;
    }
    loadRepairStatus(form.customerId);
    const intervalId = window.setInterval(() => loadRepairStatus(form.customerId), 1000);
    return () => window.clearInterval(intervalId);
  }, [form.customerId]);

  const selectedItems = useMemo(() => ITEM_CATALOG.map((item) => {
    const state = items[item.id] || { selected: false, quantity: 0 };
    const quantity = Number(state.quantity || 0);
    if (!state.selected || quantity <= 0) return null;
    return { ...item, quantity, subtotal: quantity * item.price };
  }).filter(Boolean), [items]);

  const total = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const selectedRepairQty = selectedItems.find((item) => item.id === "repair-kit")?.quantity || 0;
  const projectedRepairTotal = repairLast24h + selectedRepairQty;
  const willHitRepairCooldown = selectedRepairQty > 0 && projectedRepairTotal > 3;
  const totalValue = sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

  const updateFormField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleItem = (id, checked) => {
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], selected: Boolean(checked), quantity: checked ? Math.max(1, Number(prev[id]?.quantity || 0)) : 0 },
    }));
  };

  const updateQty = (id, value) => {
    const quantity = Math.max(0, Number(value || 0));
    setItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], quantity, selected: quantity > 0 },
    }));
  };

  const reset = () => {
    setForm((prev) => ({
      customerName: "",
      customerId: "",
      mechanicName: discordUser?.global_name || discordUser?.username || prev.mechanicName,
      mechanicId: discordUser?.id || prev.mechanicId,
    }));
    setItems(createInitialSelection());
  };

  const register = async () => {
    if (!discordUser) {
      setStatus("É necessário entrar com Discord para registrar vendas.");
      return;
    }
    if (!form.customerId || !form.customerName || !form.mechanicName || !form.mechanicId) {
      setStatus("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!selectedItems.length) {
      setStatus("Selecione pelo menos um item.");
      return;
    }
    setIsSubmitting(true);
    const currentCustomerId = form.customerId;
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: form.customerName, customerId: form.customerId, mechanicName: form.mechanicName, mechanicId: form.mechanicId, items: selectedItems, total }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (typeof data?.cooldownRemainingMs === "number") setCooldownRemainingMs(data.cooldownRemainingMs);
        if (typeof data?.repairLast24h === "number") setRepairLast24h(data.repairLast24h);
        throw new Error(data?.error || "Falha ao registrar venda.");
      }
      setStatus("Venda registrada com sucesso.");
      reset();
      await Promise.all([loadSales(), loadRepairStatus(currentCustomerId)]);
    } catch (error) {
      setStatus(error.message || "Falha ao registrar venda.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSale = async (saleId) => {
    try {
      const response = await fetch(`/api/sales/${saleId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Falha ao excluir venda.");
      await loadSales();
      if (form.customerId) await loadRepairStatus(form.customerId);
    } catch (error) {
      setStatus(error.message || "Falha ao excluir venda.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top, rgba(215,58,58,0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(232,208,137,0.12), transparent 25%), #050505", color: colors.text, fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) 1fr", gap: 24, alignItems: "stretch", marginBottom: 24 }}>
          <div style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))", border: `1px solid ${colors.border}`, borderRadius: 28, padding: 24, backdropFilter: "blur(10px)", display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 220 }}>
            <img src="/logo-vallar.png" alt="Vallar Originals" style={{ width: "100%", maxWidth: 280, height: "auto", objectFit: "contain", marginBottom: 18 }} />
            <div style={{ color: colors.gold, fontSize: 12, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 }}>Oficina Premium</div>
            <h1 style={{ fontSize: 34, lineHeight: 1.05, margin: 0, marginBottom: 10, fontWeight: 900 }}>Vallar Originals Sales Panel</h1>
            <p style={{ margin: 0, color: colors.muted, maxWidth: 520, fontSize: 15 }}>Painel unificado com Next.js, banco de dados e autenticação via Discord.</p>

            <div style={{ marginTop: 18 }}>
              {discordUser ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 16, background: "rgba(232,208,137,0.08)", border: `1px solid ${colors.goldSoft}` }}>
                  <div>
                    <div style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>Logado com Discord</div>
                    <div style={{ fontWeight: 800 }}>{discordUser.global_name || discordUser.username}</div>
                    <div style={{ color: colors.muted, fontSize: 13 }}>ID: {discordUser.id}</div>
                  </div>
                  <a href="/api/auth/logout" style={{ textDecoration: "none", background: "#111", color: colors.gold, border: `1px solid ${colors.border}`, padding: "10px 14px", borderRadius: 12, fontWeight: 800 }}>Sair</a>
                </div>
              ) : (
                <a href="/api/auth/discord/login" style={{ display: "inline-block", textDecoration: "none", background: colors.gold, color: "#000", padding: "12px 16px", borderRadius: 14, fontWeight: 900 }}>Entrar com Discord</a>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 18, alignContent: "start" }}>
            <StatCard label="Vendas registradas" value={sales.length} />
            <StatCard label="Valor acumulado" value={currency(totalValue)} accent={colors.red} />
            <StatCard label="Repair Kit hoje" value={`${repairLast24h}/3`} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 520px) 1fr", gap: 24 }}>
          <section style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 28, padding: 24 }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ color: colors.gold, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Registro</div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Nova venda</h2>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input style={inputStyle()} placeholder="Nome" value={form.customerName} onChange={(e) => updateFormField("customerName", e.target.value)} />
                <input style={inputStyle()} placeholder="ID" value={form.customerId} onChange={(e) => updateFormField("customerId", e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input style={inputStyle()} placeholder="Nome do Mecânico" value={form.mechanicName} onChange={(e) => updateFormField("mechanicName", e.target.value)} />
                <input style={inputStyle()} placeholder="ID do Mecânico" value={form.mechanicId} onChange={(e) => updateFormField("mechanicId", e.target.value)} />
              </div>
            </div>

            <div style={{ height: 1, background: colors.whiteSoft, margin: "22px 0" }} />

            <div style={{ display: "grid", gap: 12 }}>
              {ITEM_CATALOG.map((item) => {
                const selected = Boolean(items[item.id]?.selected);
                return (
                  <div key={item.id} style={{ display: "grid", gridTemplateColumns: "26px 1fr 120px", gap: 14, alignItems: "center", padding: 16, borderRadius: 18, border: `1px solid ${selected ? colors.goldSoft : colors.border}`, background: selected ? "rgba(232,208,137,0.07)" : colors.panel }}>
                    <input type="checkbox" checked={selected} onChange={(e) => toggleItem(item.id, e.target.checked)} style={{ width: 18, height: 18, accentColor: colors.gold }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{item.icon} {item.name}</div>
                      <div style={{ color: colors.muted, fontSize: 13 }}>{currency(item.price)} por unidade</div>
                    </div>
                    <input style={inputStyle("center")} type="number" min="0" value={items[item.id]?.quantity ?? 0} onChange={(e) => updateQty(item.id, e.target.value)} />
                  </div>
                );
              })}
            </div>

            <div style={{ height: 1, background: colors.whiteSoft, margin: "22px 0" }} />

            {(form.customerId || selectedRepairQty > 0) && (
              <div style={{ border: `1px solid ${willHitRepairCooldown || repairLast24h >= 3 ? colors.redSoft : colors.goldSoft}`, background: willHitRepairCooldown || repairLast24h >= 3 ? "rgba(215,58,58,0.08)" : "rgba(232,208,137,0.06)", borderRadius: 18, padding: 16, marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 800 }}>Controle Repair Kit</div>
                  <div style={{ color: colors.gold, fontWeight: 900 }}>{repairLast24h}/3 no dia</div>
                </div>
                {cooldownRemainingMs > 0 && repairLast24h >= 3 ? (
                  <div style={{ color: colors.red, fontWeight: 800 }}>Libera em: {formatRemainingTime(cooldownRemainingMs)}</div>
                ) : (
                  <div style={{ color: colors.muted, fontSize: 14 }}>Máximo de 3 vendas com Repair Kit por dia para o mesmo ID.</div>
                )}
                {willHitRepairCooldown && <div style={{ color: colors.red, marginTop: 8, fontSize: 14 }}>Esta venda ultrapassa o limite permitido para Repair Kit.</div>}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 16, alignItems: "center", padding: 18, borderRadius: 22, background: "linear-gradient(135deg, rgba(232,208,137,1) 0%, rgba(214,176,76,1) 100%)", color: "#000", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", opacity: 0.72, marginBottom: 4 }}>Resumo da venda</div>
                <div style={{ fontSize: 30, fontWeight: 900 }}>{currency(total)}</div>
              </div>
              <button type="button" onClick={register} disabled={isSubmitting || !discordUser} style={{ border: "none", background: "#090909", color: colors.gold, padding: "14px 18px", borderRadius: 16, fontWeight: 900, cursor: isSubmitting ? "wait" : "pointer", minWidth: 140, opacity: isSubmitting || !discordUser ? 0.7 : 1 }}>
                {isSubmitting ? "Salvando..." : "Registrar"}
              </button>
            </div>

            {status && <div style={{ borderRadius: 16, padding: 14, background: "rgba(232,208,137,0.08)", border: `1px solid ${colors.goldSoft}`, color: colors.gold, fontWeight: 700 }}>{status}</div>}
          </section>

          <section style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 28, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div style={{ color: colors.red, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Histórico</div>
                <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>Relatório de vendas</h2>
              </div>
              <div style={{ minWidth: 54, height: 54, borderRadius: 18, display: "grid", placeItems: "center", background: colors.redSoft, color: colors.red, fontWeight: 900 }}>{sales.length}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginBottom: 16 }}>
              <StatCard label="Total de registros" value={sales.length} />
              <StatCard label="Valor total" value={currency(totalValue)} accent={colors.red} />
            </div>

            <div style={{ maxHeight: 720, overflowY: "auto", paddingRight: 4, display: "grid", gap: 14 }}>
              {isLoadingSales ? (
                <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 22, padding: 28, textAlign: "center", color: colors.muted, background: colors.panel }}>Carregando vendas...</div>
              ) : sales.length === 0 ? (
                <div style={{ border: `1px dashed ${colors.border}`, borderRadius: 22, padding: 28, textAlign: "center", color: colors.muted, background: colors.panel }}>Nenhuma venda registrada ainda.</div>
              ) : (
                sales.map((sale) => (
                  <div key={sale.id} style={{ border: `1px solid ${colors.border}`, borderRadius: 22, padding: 18, background: colors.panel }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 14 }}>
                      <div>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: colors.gold, color: "#000", borderRadius: 999, padding: "6px 12px", fontSize: 13, fontWeight: 900, marginBottom: 10 }}>{sale.customer_name}</div>
                        <div style={{ color: colors.muted, fontSize: 14, lineHeight: 1.6 }}>
                          <div>ID cliente: {sale.customer_id}</div>
                          <div>Mecânico: {sale.mechanic_name}</div>
                          <div>ID mecânico: {sale.mechanic_id}</div>
                        </div>
                      </div>
                      <button type="button" onClick={() => deleteSale(sale.id)} style={{ border: `1px solid ${colors.border}`, background: "transparent", color: colors.text, borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>Excluir</button>
                    </div>

                    <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                      {(sale.items || []).map((item) => (
                        <div key={`${sale.id}-${item.id}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.03)" }}>
                          <div style={{ fontWeight: 700 }}>{item.name}</div>
                          <div style={{ color: colors.muted }}>x{item.quantity}</div>
                          <div style={{ fontWeight: 800 }}>{currency(item.subtotal)}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: `1px solid ${colors.border}` }}>
                      <span style={{ color: colors.muted, fontSize: 14 }}>{new Date(sale.created_at).toLocaleString("pt-BR")}</span>
                      <span style={{ fontSize: 22, fontWeight: 900 }}>{currency(sale.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
