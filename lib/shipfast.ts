/**
 * Thin client for the ShipFast Logistics API, always called through the
 * same-origin /api/shipfast/* rewrite (see next.config.js).
 *
 * Storefront checkout uses only the public surface:
 *   GET  /health
 *   GET  /orders/{order_id}
 *   POST /orders
 *   GET  /customers/{customer_id}/address
 *
 * GET /admin/internal-stats is used only from the CipherGuard Security Demo
 * page, to simulate a compromised app probing a restricted third-party route.
 */

const BASE = "/api/shipfast";

export interface ShipFastOrder {
  order_id: string;
  status: string;
  carrier: string;
  tracking_number: string;
  estimated_delivery: string;
  created_at: string;
}

export interface ShipFastAddress {
  customer_id: string;
  city: string;
  country: string;
  postal_code: string;
  address_type: string;
}

export class ShipFastError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ShipFastError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText || "ShipFast is not responding right now.";
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // non-JSON error body, keep default detail
    }
    throw new ShipFastError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export interface ShipFastRawResult {
  method: string;
  path: string;
  status: number;
  ok: boolean;
  body: unknown;
}

async function raw(
  method: string,
  path: string,
  body?: unknown
): Promise<ShipFastRawResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { method, path, status: res.status, ok: res.ok, body: parsed };
}

export const shipfast = {
  raw,

  health(): Promise<{ status: string }> {
    return fetch(`${BASE}/health`, { cache: "no-store" }).then((r) => handle(r));
  },

  getOrder(orderId: string): Promise<ShipFastOrder> {
    return fetch(`${BASE}/orders/${encodeURIComponent(orderId)}`, {
      cache: "no-store",
    }).then((r) => handle(r));
  },

  createOrder(payload: {
    customer_id: string;
    destination_city: string;
    items_count: number;
  }): Promise<ShipFastOrder> {
    return fetch(`${BASE}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => handle(r));
  },

  getCustomerAddress(customerId: string): Promise<ShipFastAddress> {
    return fetch(`${BASE}/customers/${encodeURIComponent(customerId)}/address`, {
      cache: "no-store",
    }).then((r) => handle(r));
  },
};
