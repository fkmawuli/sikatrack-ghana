import { forwardRef } from "react";
import clsx from "clsx";
import { formatGHS, toNumber } from "@/lib/money";
import { formatDateTime } from "@/lib/datetime";
import type { Sale } from "@/types";

export interface ReceiptBusiness {
  name: string;
  phone: string | null;
  location: string | null;
  taxId: string | null;
  logoUrl: string | null;
}

export interface ReceiptSettings {
  receiptFooterMessage: string | null;
  returnPolicy: string | null;
  showReprintLabel: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  MOMO: "Mobile Money",
  BANK_TRANSFER: "Bank Transfer",
};

const Receipt = forwardRef<
  HTMLDivElement,
  {
    sale: Sale;
    business: ReceiptBusiness;
    settings: ReceiptSettings;
    size: "58mm" | "80mm" | "A4";
    isReprint?: boolean;
  }
>(({ sale, business, settings, size, isReprint }, ref) => {
  const sizeClass = size === "58mm" ? "receipt-58mm" : size === "80mm" ? "receipt-80mm" : "receipt-a4";

  return (
    <div ref={ref} id="receipt-print-area" className={clsx(sizeClass, "bg-white text-black mx-auto p-3")}>
      {isReprint && settings.showReprintLabel && (
        <p className="text-center font-bold border border-black mb-2 py-0.5">REPRINT</p>
      )}

      <div className="text-center mb-2">
        {business.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.logoUrl} alt="" className="h-12 mx-auto mb-1 object-contain" />
        )}
        <p className="font-bold text-base">{business.name}</p>
        {business.location && <p>{business.location}</p>}
        {business.phone && <p>{business.phone}</p>}
        {business.taxId && <p>Tax ID: {business.taxId}</p>}
      </div>

      <div className="border-t border-b border-dashed border-black py-1 mb-2">
        <p>Receipt: {sale.receiptNumber}</p>
        <p>Date: {formatDateTime(sale.createdAt)}</p>
        <p>Cashier: {sale.cashier?.name ?? "—"}</p>
        {sale.customerName && <p>Customer: {sale.customerName}</p>}
        {sale.customerPhone && <p>Phone: {sale.customerPhone}</p>}
      </div>

      <table className="w-full mb-2">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left font-normal">Item</th>
            <th className="text-right font-normal">Qty</th>
            <th className="text-right font-normal">Price</th>
            <th className="text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item) => (
            <tr key={item.id}>
              <td className="text-left py-0.5">{item.productName}</td>
              <td className="text-right">{toNumber(item.quantity)}</td>
              <td className="text-right">{toNumber(item.unitPrice).toFixed(2)}</td>
              <td className="text-right">{toNumber(item.lineTotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-dashed border-black pt-1 space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatGHS(sale.subtotal)}</span>
        </div>
        {toNumber(sale.discountAmount) > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{formatGHS(sale.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-black pt-0.5">
          <span>TOTAL</span>
          <span>{formatGHS(sale.totalAmount)}</span>
        </div>
        {sale.payments.map((p) => (
          <div key={p.id} className="flex justify-between">
            <span>{METHOD_LABELS[p.method]}</span>
            <span>{formatGHS(p.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span>Amount received</span>
          <span>{formatGHS(sale.amountReceived)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Change</span>
          <span>{formatGHS(sale.changeGiven)}</span>
        </div>
      </div>

      {settings.returnPolicy && (
        <p className="border-t border-dashed border-black mt-2 pt-1 text-center">{settings.returnPolicy}</p>
      )}
      <p className="text-center mt-2 font-medium">{settings.receiptFooterMessage || "Thank you for your business!"}</p>
    </div>
  );
});
Receipt.displayName = "Receipt";

export default Receipt;
