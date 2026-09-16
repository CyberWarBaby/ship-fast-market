# ShipFast Market

Frontend-only customer shop (Next.js 14, TypeScript, Tailwind CSS).

This repo is **the storefront**, not CipherGuard and not the ShipFast API.
Browse products locally; every business operation talks to the live ShipFast
backend. The UI does **not** invent successful logistics responses.

If ShipFast is down, checkout, shipping and tracking are blocked.

## Required backends

| Service | Default | Used for |
|---|---|---|
| ShipFast | `http://localhost:8002` | Health, address lookup, create order, track order |
| PayFlex | `http://localhost:8006` | Charge payment |

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Start ShipFast (and PayFlex) **before** using checkout. The navbar shows
**ShipFast live** or **ShipFast down**.

## Live ShipFast calls (never stubbed)

- `GET /health` — connection status
- `GET /customers/{customer_id}/address` — required before payment
- `POST /orders` — required to finish checkout
- `GET /orders/{order_id}` — tracking page

PayFlex: `POST /payments/charge`. `/admin/*` is never called.

If address lookup or order create fails, checkout stops. There is no fake
order id or fake “success” in the frontend.

## CORS

The browser only calls same-origin `/api/shipfast/*` and `/api/payflex/*`.
Next.js rewrites those to `SHIPFAST_UPSTREAM_URL` / `PAYFLEX_UPSTREAM_URL`
(see `next.config.js`). Set those env vars to the public ShipFast/PayFlex
URLs in production.

## What is local vs live

- **Local (shop-owned):** product catalog, cart, name/phone form. ShipFast has no catalog API.
- **Live ShipFast:** address, shipping, orders, tracking.
- **Live PayFlex:** payment charge.

Order history in `localStorage` is only a copy of a response **after**
ShipFast actually created the order.
