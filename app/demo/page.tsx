"use client";

import { FormEvent, useState } from "react";
import { shipfast, ShipFastRawResult } from "@/lib/shipfast";
import { getOrderHistory } from "@/lib/orders-store";
import { useCustomer } from "@/lib/customer-context";
import { useShipFastStatus } from "@/lib/shipfast-status";

type NormalAction =
  | "health"
  | "get-order"
  | "shipping"
  | "address"
  | "create";

const NORMAL_ACTIONS: { id: NormalAction; label: string; hint: string }[] = [
  { id: "health", label: "Health check", hint: "GET /health" },
  { id: "get-order", label: "Get order", hint: "GET /orders/{id}" },
  { id: "shipping", label: "Get shipping status", hint: "GET /orders/{id}" },
  { id: "address", label: "Get customer address", hint: "GET /customers/{id}/address" },
  { id: "create", label: "Create shipment", hint: "POST /orders" },
];

export default function SecurityDemoPage() {
  const { online, checking } = useShipFastStatus();
  const { profile } = useCustomer();
  const lastOrder = getOrderHistory()[0];

  const [action, setAction] = useState<NormalAction>("get-order");
  const [orderId, setOrderId] = useState(lastOrder?.shipfastOrderId ?? "ord_101");
  const [customerId, setCustomerId] = useState(profile?.customerId ?? "cust_101");
  const [city, setCity] = useState(profile?.city ?? "Lagos");
  const [itemsCount, setItemsCount] = useState(1);

  const [busy, setBusy] = useState<"normal" | "restricted" | null>(null);
  const [result, setResult] = useState<ShipFastRawResult | null>(null);
  const [kind, setKind] = useState<"normal" | "restricted" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runNormal(e: FormEvent) {
    e.preventDefault();
    setBusy("normal");
    setError(null);
    try {
      let next: ShipFastRawResult;
      if (action === "health") {
        next = await shipfast.raw("GET", "/health");
      } else if (action === "get-order" || action === "shipping") {
        const id = orderId.trim();
        if (!id) throw new Error("Enter an order ID from a real ShipFast booking.");
        next = await shipfast.raw("GET", `/orders/${encodeURIComponent(id)}`);
      } else if (action === "address") {
        const id = customerId.trim();
        if (!id) throw new Error("Enter a customer ID.");
        next = await shipfast.raw(
          "GET",
          `/customers/${encodeURIComponent(id)}/address`
        );
      } else {
        next = await shipfast.raw("POST", "/orders", {
          customer_id: customerId.trim() || "cust_101",
          destination_city: city,
          items_count: Math.max(1, itemsCount),
        });
      }
      setKind("normal");
      setResult(next);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runRestricted() {
    setBusy("restricted");
    setError(null);
    try {
      const next = await shipfast.raw("GET", "/admin/internal-stats");
      setKind("restricted");
      setResult(next);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setBusy(null);
    }
  }

  const needsOrder = action === "get-order" || action === "shipping";
  const needsCustomer = action === "address" || action === "create";

  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <p className="text-sm font-medium uppercase tracking-wide text-clay">
        Hackathon demonstration
      </p>
      <h1 className="mt-2 font-display text-3xl text-ink">
        CipherGuard Security Demo
      </h1>
      <p className="mt-3 max-w-2xl text-ink/70">
        The marketplace itself stays a legitimate customer app. This page is
        only for the demo: send a normal ShipFast business request, or simulate
        a compromised component probing a restricted third-party route.
      </p>
      {!checking && !online && (
        <p className="mt-4 border border-clay/30 bg-clay-tint px-3 py-2 text-sm text-clay">
          ShipFast is unreachable. Both demo actions need the live logistics API.
        </p>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="border border-ink/10 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-leaf">
            Legitimate traffic
          </p>
          <h2 className="mt-1 font-display text-xl text-ink">Normal API requests</h2>
          <p className="mt-2 text-sm text-ink/65">
            These are the same ShipFast calls the shop uses for orders, shipping
            status and address lookup. PayFlex is not involved.
          </p>
          <form onSubmit={runNormal} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink/70">Request</span>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as NormalAction)}
                className="input"
              >
                {NORMAL_ACTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label} — {opt.hint}
                  </option>
                ))}
              </select>
            </label>
            {needsOrder && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink/70">Order ID</span>
                <input
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="input"
                  placeholder="ord_101"
                />
              </label>
            )}
            {needsCustomer && (
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink/70">Customer ID</span>
                <input
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="input"
                  placeholder="cust_101"
                />
              </label>
            )}
            {action === "create" && (
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm text-ink/70">City</span>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm text-ink/70">Items</span>
                  <input
                    type="number"
                    min={1}
                    value={itemsCount}
                    onChange={(e) => setItemsCount(Number(e.target.value) || 1)}
                    className="input"
                  />
                </label>
              </div>
            )}
            <button
              type="submit"
              disabled={busy !== null || (!online && !checking)}
              className="w-full border border-indigo bg-indigo py-3 text-sm font-medium text-parchment hover:bg-indigo-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "normal" ? "Sending to ShipFast…" : "Send legitimate request"}
            </button>
          </form>
        </section>

        <section className="border border-clay/25 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-clay">
            Security test
          </p>
          <h2 className="mt-1 font-display text-xl text-ink">Restricted resource</h2>
          <p className="mt-2 text-sm text-ink/65">
            Simulate a compromised application component attempting to access a
            restricted third-party API resource.
          </p>
          <p className="mt-4 border border-clay/20 bg-clay-tint px-3 py-2 text-sm text-ink/80">
            Sends <code className="text-xs">GET /admin/internal-stats</code> to
            ShipFast. A customer app should never call this. Direct to the
            carrier it may succeed; CipherGuard is what would block it.
          </p>
          <button
            type="button"
            onClick={runRestricted}
            disabled={busy !== null || (!online && !checking)}
            className="mt-6 w-full border border-clay bg-clay py-3 text-sm font-medium text-parchment hover:bg-clay/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "restricted"
              ? "Probing restricted route…"
              : "Run security test"}
          </button>
        </section>
      </div>

      {(result || error) && (
        <section className="mt-8 border border-ink/10 bg-indigo-deep p-6 text-parchment">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl">Live ShipFast response</h2>
            {kind && (
              <span
                className={`border px-2 py-1 text-[11px] font-medium uppercase tracking-wide ${
                  kind === "restricted"
                    ? "border-ochre/50 text-ochre"
                    : "border-parchment/30 text-parchment/80"
                }`}
              >
                {kind === "restricted" ? "Restricted probe" : "Legitimate request"}
              </span>
            )}
          </div>
          {error && <p className="mt-3 text-sm text-ochre">{error}</p>}
          {result && (
            <>
              <p className="mt-3 font-mono text-sm text-parchment/80">
                {result.method} {result.path}
                <span className="ml-3">HTTP {result.status}</span>
              </p>
              <pre className="mt-4 overflow-x-auto border border-parchment/15 bg-indigo p-4 text-xs leading-relaxed text-parchment/90">
                {JSON.stringify(result.body, null, 2)}
              </pre>
            </>
          )}
        </section>
      )}
    </div>
  );
}
