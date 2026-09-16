"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { useCustomer } from "@/lib/customer-context";
import { getProduct } from "@/lib/catalog";
import { formatNaira, shortId } from "@/lib/format";
import { shipfast, ShipFastError } from "@/lib/shipfast";
import { saveOrder } from "@/lib/orders-store";
import { useShipFastStatus } from "@/lib/shipfast-status";
import { PaymentMethod } from "@/lib/types";

const DELIVERY_FEE = 1500;
const CITIES = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Ibadan",
  "Kano",
  "Enugu",
  "Benin City",
  "Kaduna",
];

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: "card", label: "Card (Demo)", hint: "Any card details are accepted." },
  { id: "bank", label: "Bank Transfer (Demo)", hint: "Marked paid without a real transfer." },
  { id: "cod", label: "Cash on Delivery", hint: "Pay the rider when the parcel arrives." },
];

type Step = "details" | "payment" | "placing" | "error";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, totalItems, clear } = useCart();
  const { profile, saveProfile } = useCustomer();
  const { online, checking, error: shipfastStatusError, refresh } = useShipFastStatus();

  const [step, setStep] = useState<Step>("details");
  const [zoneNote, setZoneNote] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");

  const [details, setDetails] = useState({
    fullName: profile?.fullName ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    city: profile?.city ?? CITIES[0],
    address: profile?.address ?? "",
  });

  const [card, setCard] = useState({
    name: "",
    number: "",
    expiry: "",
    cvv: "",
  });

  const total = subtotal + DELIVERY_FEE;

  const lineItems = useMemo(
    () =>
      items
        .map((i) => ({ item: i, product: getProduct(i.productId) }))
        .filter((x) => x.product),
    [items]
  );

  if (items.length === 0 && step === "details") {
    return (
      <div className="mx-auto max-w-content px-4 py-20 text-center sm:px-6">
        <p className="font-display text-2xl text-ink">Your basket is empty</p>
        <p className="mt-2 text-ink/60">Add something to the basket before checking out.</p>
      </div>
    );
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    const reachable = online || (await refresh());
    if (!reachable) {
      setErrorMessage(
        shipfastStatusError ??
          "Cannot reach the ShipFast API. Checkout is blocked until logistics is online."
      );
      return;
    }
    const saved = saveProfile(details);
    try {
      const addr = await shipfast.getCustomerAddress(saved.customerId);
      setZoneNote(`Delivery zone confirmed by ShipFast: ${addr.city}, ${addr.country}.`);
      setStep("payment");
    } catch (err) {
      setZoneNote(null);
      if (err instanceof ShipFastError) {
        setErrorMessage(
          `ShipFast address lookup failed — ${err.message}. Checkout cannot continue without a live logistics response.`
        );
      } else {
        setErrorMessage(
          "ShipFast address lookup failed. Checkout cannot continue without a live logistics response."
        );
      }
    }
  }

  async function handlePlaceOrder(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setStep("placing");

    const customerId = profile?.customerId ?? saveProfile(details).customerId;
    const reachable = online || (await refresh());
    if (!reachable) {
      setStep("error");
      setErrorMessage(
        shipfastStatusError ??
          "Cannot reach the ShipFast API. The order was not created."
      );
      return;
    }

    try {
      const paymentId = `sim_${method}_${shortId("pay")}`;
      const order = await shipfast.createOrder({
        customer_id: customerId,
        destination_city: details.city,
        items_count: totalItems,
      });
      saveOrder({
        localId: shortId("loc"),
        shipfastOrderId: order.order_id,
        paymentId,
        paymentMethod: method,
        trackingNumber: order.tracking_number,
        carrier: order.carrier,
        status: order.status,
        estimatedDelivery: order.estimated_delivery,
        amountNaira: total,
        itemsCount: totalItems,
        destinationCity: details.city,
        createdAt: order.created_at,
      });
      clear();
      router.push(`/orders/${order.order_id}`);
    } catch (err) {
      setStep("error");
      if (err instanceof ShipFastError) {
        setErrorMessage(
          `Payment was recorded as a demo success, but ShipFast did not book delivery — ${err.message}.`
        );
      } else {
        setErrorMessage(
          "Payment was recorded as a demo success, but ShipFast did not book delivery."
        );
      }
    }
  }

  return (
    <div className="mx-auto max-w-content px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl text-ink">Checkout</h1>
      <Steps current={step} />
      {!checking && !online && (
        <p className="mt-4 border border-clay/30 bg-clay-tint px-3 py-2 text-sm text-clay">
          {shipfastStatusError ??
            "ShipFast API is unreachable. Checkout is disabled until the logistics backend responds."}
        </p>
      )}
      {(step === "details" || step === "payment") && errorMessage && (
        <p className="mt-4 border border-clay/30 bg-clay-tint px-3 py-2 text-sm text-clay">
          {errorMessage}
        </p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          {step === "details" && (
            <form onSubmit={handleDetailsSubmit} className="space-y-5 border border-ink/10 bg-white p-6">
              <h2 className="font-display text-xl text-ink">Delivery address</h2>
              <Field label="Full name">
                <input
                  required
                  value={details.fullName}
                  onChange={(e) => setDetails({ ...details, fullName: e.target.value })}
                  className="input"
                  placeholder="Chidinma Okafor"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Phone number">
                  <input
                    required
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                    className="input"
                    placeholder="080X XXX XXXX"
                  />
                </Field>
                <Field label="Email">
                  <input
                    required
                    type="email"
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                    className="input"
                    placeholder="you@example.com"
                  />
                </Field>
              </div>
              <Field label="City">
                <select
                  value={details.city}
                  onChange={(e) => setDetails({ ...details, city: e.target.value })}
                  className="input"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Delivery address">
                <textarea
                  required
                  value={details.address}
                  onChange={(e) => setDetails({ ...details, address: e.target.value })}
                  className="input min-h-[80px]"
                  placeholder="Street, house number, landmark"
                />
              </Field>
              <button
                type="submit"
                disabled={!online && !checking}
                className="w-full border border-indigo bg-indigo py-3 text-sm font-medium text-parchment hover:bg-indigo-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to payment
              </button>
            </form>
          )}

          {step === "payment" && (
            <form onSubmit={handlePlaceOrder} className="space-y-5 border border-ink/10 bg-white p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-ink">Payment method</h2>
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="text-sm text-indigo-deep hover:underline"
                >
                  Edit delivery address
                </button>
              </div>
              {zoneNote && (
                <p className="border border-leaf/30 bg-leaf-tint px-3 py-2 text-sm text-leaf">
                  {zoneNote}
                </p>
              )}

              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm text-ink/70">How would you like to pay?</legend>
                {PAYMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-3 border px-3 py-3 ${
                      method === opt.id ? "border-indigo bg-indigo-tint/40" : "border-ink/10 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      checked={method === opt.id}
                      onChange={() => setMethod(opt.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{opt.label}</span>
                      <span className="block text-xs text-ink/55">{opt.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>

              {method === "card" && (
                <div className="space-y-4 border border-ink/10 p-4">
                  <p className="text-xs text-ink/50">
                    Demo card — any name, number, expiry or CVV is accepted. Nothing is charged.
                  </p>
                  <Field label="Name on card">
                    <input
                      required
                      value={card.name}
                      onChange={(e) => setCard({ ...card, name: e.target.value })}
                      className="input"
                      placeholder="Anything is fine"
                    />
                  </Field>
                  <Field label="Card number">
                    <input
                      required
                      value={card.number}
                      onChange={(e) => setCard({ ...card, number: e.target.value })}
                      className="input"
                      placeholder="1234 or banana — all accepted"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Expiry">
                      <input
                        required
                        value={card.expiry}
                        onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                        className="input"
                        placeholder="MM/YY or anything"
                      />
                    </Field>
                    <Field label="CVV">
                      <input
                        required
                        value={card.cvv}
                        onChange={(e) => setCard({ ...card, cvv: e.target.value })}
                        className="input"
                        placeholder="Any value"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {method === "bank" && (
                <p className="border border-ink/10 bg-parchment2 px-3 py-2 text-sm text-ink/70">
                  Demo transfer to ShipFast Market — GTBank 0123456789. Click Place order
                  and we will treat it as paid.
                </p>
              )}

              {method === "cod" && (
                <p className="border border-ink/10 bg-parchment2 px-3 py-2 text-sm text-ink/70">
                  Pay the ShipFast rider in cash when your order arrives.
                </p>
              )}

              <button
                type="submit"
                className="w-full border border-ochre-deep bg-ochre py-3 text-sm font-medium text-white hover:bg-ochre-deep"
              >
                Place order {formatNaira(total)}
              </button>
            </form>
          )}

          {step === "placing" && (
            <div className="border border-ink/10 bg-white p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo/30 border-t-indigo" />
              <p className="mt-4 font-display text-lg text-ink">
                Recording demo payment and booking ShipFast delivery…
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4 border border-clay/30 bg-clay-tint p-6">
              <h2 className="font-display text-xl text-clay">Something needs your attention</h2>
              <p className="text-sm text-ink/80">{errorMessage}</p>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setStep("payment");
                }}
                className="border border-indigo bg-indigo px-4 py-2 text-sm font-medium text-parchment hover:bg-indigo-deep"
              >
                Back to payment
              </button>
            </div>
          )}
        </div>

        <aside className="h-fit border border-ink/10 bg-white p-6">
          <h2 className="font-display text-xl text-ink">Order summary</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {lineItems.map(({ item, product }) => (
              <li key={item.productId} className="flex justify-between gap-3">
                <span className="text-ink/70">
                  {product!.name} × {item.qty}
                </span>
                <span>{formatNaira(product!.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-ink/10 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink/60">Subtotal</dt>
              <dd>{formatNaira(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink/60">Delivery (ShipFast)</dt>
              <dd>{formatNaira(DELIVERY_FEE)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex justify-between border-t border-ink/10 pt-4 font-display text-lg text-ink">
            <span>Total</span>
            <span>{formatNaira(total)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Steps({ current }: { current: Step }) {
  const order: { key: Step[]; label: string }[] = [
    { key: ["details"], label: "Delivery" },
    { key: ["payment"], label: "Payment" },
    { key: ["placing", "error"], label: "Place order" },
  ];
  return (
    <div className="mt-4 flex items-center gap-3 text-sm">
      {order.map((s, i) => {
        const active = s.key.includes(current);
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                active ? "bg-indigo text-parchment" : "bg-ink/10 text-ink/50"
              }`}
            >
              {i + 1}
            </span>
            <span className={active ? "text-ink" : "text-ink/45"}>{s.label}</span>
            {i < order.length - 1 && <span className="h-px w-8 bg-ink/15" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink/70">{label}</span>
      {children}
    </label>
  );
}
