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

type Step = "details" | "placing" | "error";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, totalItems, clear } = useCart();
  const { profile, saveProfile } = useCustomer();
  const { online, checking, error: shipfastStatusError, refresh } = useShipFastStatus();

  const [step, setStep] = useState<Step>("details");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [details, setDetails] = useState({
    fullName: profile?.fullName ?? "",
    phone: profile?.phone ?? "",
    email: profile?.email ?? "",
    city: profile?.city ?? CITIES[0],
    address: profile?.address ?? "",
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

  async function handlePlaceOrder(e: FormEvent) {
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
    setStep("placing");

    try {
      await shipfast.getCustomerAddress(saved.customerId);
      const paymentId = `sim_${shortId("pay")}`;
      const order = await shipfast.createOrder({
        customer_id: saved.customerId,
        destination_city: details.city,
        items_count: totalItems,
      });
      saveOrder({
        localId: shortId("loc"),
        shipfastOrderId: order.order_id,
        paymentId,
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
          `ShipFast did not complete this order — ${err.message}. Payment was only simulated; nothing was charged.`
        );
      } else {
        setErrorMessage(
          "ShipFast did not complete this order. Payment was only simulated; nothing was charged."
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
      {step === "details" && errorMessage && (
        <p className="mt-4 border border-clay/30 bg-clay-tint px-3 py-2 text-sm text-clay">
          {errorMessage}
        </p>
      )}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          {step === "details" && (
            <form onSubmit={handlePlaceOrder} className="space-y-5 border border-ink/10 bg-white p-6">
              <h2 className="font-display text-xl text-ink">Delivery details</h2>
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
              <p className="border border-leaf/30 bg-leaf-tint px-3 py-2 text-sm text-leaf">
                Payment is simulated for this demo. PayFlex is not called. Placing
                the order books delivery on the live ShipFast API immediately.
              </p>
              <button
                type="submit"
                disabled={!online && !checking}
                className="w-full border border-ochre-deep bg-ochre py-3 text-sm font-medium text-white hover:bg-ochre-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                Place order {formatNaira(total)}
              </button>
            </form>
          )}

          {step === "placing" && (
            <div className="border border-ink/10 bg-white p-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-indigo/30 border-t-indigo" />
              <p className="mt-4 font-display text-lg text-ink">
                Booking your delivery with ShipFast…
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
                  setStep("details");
                }}
                className="border border-indigo bg-indigo px-4 py-2 text-sm font-medium text-parchment hover:bg-indigo-deep"
              >
                Back to checkout
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
    { key: ["placing", "error"], label: "ShipFast booking" },
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
