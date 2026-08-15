import { PrismaClient, PaymentMethod, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Sika@2026";

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Seeding does hundreds of small sequential writes against a remote pooled
 * Postgres connection (Supabase). Over a slow/high-latency link the pooler can
 * drop an idle connection mid-run (Prisma error P1017) or a query can time out
 * (P1001/P2024) - both transient. Retry with backoff instead of aborting the
 * whole script over one flaky round trip.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 9): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      const delay = Math.min(1000 * attempt, 8000);
      console.log(`  (transient error, retrying in ${delay}ms: ${(err as Error).message.split("\n")[0]})`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("unreachable");
}

async function main() {
  console.log("Seeding KudiTrack demo data...");

  await withRetry(() => prisma.auditLog.deleteMany());
  await withRetry(() => prisma.reconciliation.deleteMany());
  await withRetry(() => prisma.returnItem.deleteMany());
  await withRetry(() => prisma.return.deleteMany());
  await withRetry(() => prisma.payment.deleteMany());
  await withRetry(() => prisma.saleItem.deleteMany());
  await withRetry(() => prisma.sale.deleteMany());
  await withRetry(() => prisma.stockMovement.deleteMany());
  await withRetry(() => prisma.expense.deleteMany());
  await withRetry(() => prisma.expenseCategory.deleteMany());
  await withRetry(() => prisma.product.deleteMany());
  await withRetry(() => prisma.supplier.deleteMany());
  await withRetry(() => prisma.category.deleteMany());
  await withRetry(() => prisma.user.deleteMany());
  await withRetry(() => prisma.businessSettings.deleteMany());
  await withRetry(() => prisma.business.deleteMany());

  const business = await withRetry(() =>
    prisma.business.create({
      data: {
        name: "Adjoa's Provision Store",
        phone: "+233 24 123 4567",
        location: "Madina Market, Accra",
        email: "adjoaprovisions@example.com",
      },
    })
  );

  await withRetry(() =>
    prisma.businessSettings.create({
      data: {
        businessId: business.id,
        openingHour: 7,
        closingHour: 21,
        negativeStockAllowed: false,
        lowStockAlertEnabled: true,
        defaultReceiptSize: "80mm",
        showReprintLabel: true,
        receiptFooterMessage: "Thank you for shopping with us! Akpe / Medaase!",
        returnPolicy: "Goods may be exchanged within 3 days with a valid receipt.",
      },
    })
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const demoUsers = [
    { name: "Adjoa Mensah", email: "owner@kuditrack.demo", phone: "+233241000001", role: "OWNER" as const },
    { name: "Kwabena Owusu", email: "manager@kuditrack.demo", phone: "+233241000002", role: "MANAGER" as const },
    { name: "Ama Serwaa", email: "cashier@kuditrack.demo", phone: "+233241000003", role: "CASHIER" as const },
    { name: "Yaw Boateng", email: "stockkeeper@kuditrack.demo", phone: "+233241000004", role: "STOCK_KEEPER" as const },
    { name: "Efua Asante", email: "bookkeeper@kuditrack.demo", phone: "+233241000005", role: "BOOKKEEPER" as const },
  ];
  const [owner, manager, cashier] = await (async () => {
    const created = [];
    for (const u of demoUsers) {
      created.push(
        await withRetry(() =>
          prisma.user.create({
            data: { businessId: business.id, name: u.name, email: u.email, phone: u.phone, passwordHash, role: u.role },
          })
        )
      );
    }
    return created;
  })();

  const categoryNames = ["Beverages", "Bakery", "Staples", "Dairy", "Household", "Snacks"];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const cat = await withRetry(() => prisma.category.create({ data: { businessId: business.id, name } }));
    categories[name] = cat.id;
  }

  const expenseCategoryNames = [
    "Stock purchases",
    "Transport",
    "Utilities",
    "Rent",
    "Salaries or wages",
    "Repairs",
    "Mobile Money charges",
    "Packaging",
    "Marketing",
    "Taxes or levies",
    "Personal withdrawal",
    "Other",
  ];
  const expenseCategories: Record<string, string> = {};
  for (const name of expenseCategoryNames) {
    const cat = await withRetry(() =>
      prisma.expenseCategory.create({ data: { businessId: business.id, name, isSystem: true } })
    );
    expenseCategories[name] = cat.id;
  }

  const productSeed = [
    { sku: "WAT-001", name: "Voltic Bottled Water 750ml", category: "Beverages", unit: "piece", cost: 2.0, price: 3.0, stock: 120, reorder: 24 },
    { sku: "BEV-001", name: "Coca-Cola 350ml", category: "Beverages", unit: "piece", cost: 3.5, price: 5.0, stock: 96, reorder: 24 },
    { sku: "BEV-002", name: "Fanta Orange 350ml", category: "Beverages", unit: "piece", cost: 3.5, price: 5.0, stock: 80, reorder: 24 },
    { sku: "BAK-001", name: "Family Loaf Bread", category: "Bakery", unit: "piece", cost: 12.0, price: 16.0, stock: 30, reorder: 10 },
    { sku: "STP-001", name: "Perfect Rice 5kg", category: "Staples", unit: "bag", cost: 55.0, price: 68.0, stock: 40, reorder: 10 },
    { sku: "STP-002", name: "Frytol Cooking Oil 3L", category: "Staples", unit: "piece", cost: 60.0, price: 75.0, stock: 25, reorder: 8 },
    { sku: "DRY-001", name: "Peak Milk Powder 400g", category: "Dairy", unit: "piece", cost: 28.0, price: 35.0, stock: 50, reorder: 15 },
    { sku: "STP-003", name: "Golden Crystal Sugar 1kg", category: "Staples", unit: "piece", cost: 12.0, price: 15.5, stock: 60, reorder: 15 },
    { sku: "HH-001", name: "Key Soap Bar", category: "Household", unit: "piece", cost: 4.0, price: 6.0, stock: 100, reorder: 20 },
    { sku: "SNK-001", name: "Digestive Biscuits Pack", category: "Snacks", unit: "pack", cost: 5.5, price: 8.0, stock: 70, reorder: 20 },
    { sku: "CAN-001", name: "Titus Sardines (tin)", category: "Staples", unit: "piece", cost: 9.0, price: 12.5, stock: 45, reorder: 15 },
    { sku: "CAN-002", name: "Geisha Tinned Mackerel", category: "Staples", unit: "piece", cost: 10.0, price: 14.0, stock: 40, reorder: 15 },
  ];

  const products = [];
  for (const p of productSeed) {
    const product = await withRetry(() =>
      prisma.product.create({
        data: {
          businessId: business.id,
          sku: p.sku,
          name: p.name,
          categoryId: categories[p.category],
          unit: p.unit,
          costPrice: p.cost,
          sellingPrice: p.price,
          stockQty: p.stock,
          reorderLevel: p.reorder,
        },
      })
    );
    await withRetry(() =>
      prisma.stockMovement.create({
        data: {
          businessId: business.id,
          productId: product.id,
          type: "OPENING",
          quantity: p.stock,
          previousBalance: 0,
          newBalance: p.stock,
          reason: "Opening stock",
          userId: owner.id,
        },
      })
    );
    products.push({ ...product, runningStock: p.stock });
  }

  // ---- Historical sales for the last 35 days ----
  const cashiers = [cashier.id, manager.id, owner.id];
  const paymentMethods: PaymentMethod[] = ["CASH", "CASH", "CASH", "MOMO", "MOMO", "BANK_TRANSFER"];
  const DAYS_BACK = 35;

  for (let daysAgo = DAYS_BACK; daysAgo >= 0; daysAgo--) {
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - daysAgo);
    const weekday = day.getDay();

    // Restock day (Monday morning): top up anything running low, like a real shop
    // would when it goes to market. Without this every product would sell out to
    // zero over the simulated weeks with no replenishment.
    if (weekday === 1) {
      for (const product of products) {
        if (product.runningStock > Number(product.reorderLevel) * 3) continue;
        const restockQty = randomInt(Math.ceil(Number(product.reorderLevel) * 4), Math.ceil(Number(product.reorderLevel) * 8));
        const previousBalance = product.runningStock;
        product.runningStock += restockQty;
        const restockAt = new Date(day);
        restockAt.setHours(7, randomInt(0, 59), 0);
        await withRetry(() =>
          prisma.stockMovement.create({
            data: {
              businessId: business.id,
              productId: product.id,
              type: "RECEIVED",
              quantity: restockQty,
              previousBalance,
              newBalance: product.runningStock,
              reason: "Weekly restock",
              userId: pick([owner.id, manager.id]),
              createdAt: restockAt,
            },
          })
        );
      }
    }

    // Fewer transactions on Sundays, more on Fridays/Saturdays
    const baseCount = weekday === 0 ? randomInt(3, 6) : weekday === 5 || weekday === 6 ? randomInt(10, 18) : randomInt(6, 12);

    for (let seq = 1; seq <= baseCount; seq++) {
      const itemCount = randomInt(1, 4);
      const chosen = new Set<number>();
      while (chosen.size < itemCount) chosen.add(randomInt(0, products.length - 1));

      const saleItemsData: {
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        costPriceAtSale: Prisma.Decimal;
        lineTotal: number;
      }[] = [];
      let subtotal = 0;
      for (const idx of chosen) {
        const product = products[idx];
        const qty = randomInt(1, 5);
        if (product.runningStock < qty) continue;
        product.runningStock -= qty;
        const lineTotal = round2(Number(product.sellingPrice) * qty);
        subtotal = round2(subtotal + lineTotal);
        saleItemsData.push({
          productId: product.id,
          productName: product.name,
          quantity: qty,
          unitPrice: product.sellingPrice,
          costPriceAtSale: product.costPrice,
          lineTotal,
        });
      }
      if (saleItemsData.length === 0) continue;

      const hour = randomInt(7, 20);
      const minute = randomInt(0, 59);
      const createdAt = new Date(day);
      createdAt.setHours(hour, minute, randomInt(0, 59));

      const method = pick(paymentMethods);
      const receiptNumber = `RCT-${day.toISOString().slice(0, 10).replace(/-/g, "")}-${String(seq).padStart(4, "0")}`;
      const cashierId = pick(cashiers);

      const sale = await withRetry(() =>
        prisma.sale.create({
          data: {
            businessId: business.id,
            receiptNumber,
            cashierId,
            subtotal,
            discountAmount: 0,
            totalAmount: subtotal,
            amountReceived: subtotal,
            changeGiven: 0,
            status: "COMPLETED",
            createdAt,
            updatedAt: createdAt,
            items: { create: saleItemsData },
            payments: { create: [{ method, amount: subtotal }] },
          },
          include: { items: true },
        })
      );

      for (const item of sale.items) {
        const product = products.find((p) => p.id === item.productId)!;
        await withRetry(() =>
          prisma.stockMovement.create({
            data: {
              businessId: business.id,
              productId: item.productId,
              type: "SALE",
              quantity: -Number(item.quantity),
              previousBalance: product.runningStock + Number(item.quantity),
              newBalance: product.runningStock,
              referenceNumber: receiptNumber,
              reason: "Sale",
              userId: cashierId,
              createdAt,
            },
          })
        );
      }
    }

    if (daysAgo % 5 === 0) {
      console.log(`  ...progress: ${DAYS_BACK - daysAgo}/${DAYS_BACK} days seeded`);
    }

    // Occasional expenses
    if (randomInt(1, 3) === 1) {
      const expCategory = pick(["Transport", "Utilities", "Packaging", "Mobile Money charges", "Repairs"]);
      const expDate = new Date(day);
      expDate.setHours(randomInt(8, 19));
      await withRetry(() =>
        prisma.expense.create({
          data: {
            businessId: business.id,
            categoryId: expenseCategories[expCategory],
            description: `${expCategory} expense`,
            amount: round2(randomInt(15, 250)),
            paymentMethod: pick(["CASH", "MOMO"]),
            userId: pick([owner.id, manager.id]),
            expenseDate: expDate,
            createdAt: expDate,
          },
        })
      );
    }
    if (weekday === 5 && randomInt(1, 4) === 1) {
      const expDate = new Date(day);
      expDate.setHours(18);
      await withRetry(() =>
        prisma.expense.create({
          data: {
            businessId: business.id,
            categoryId: expenseCategories["Personal withdrawal"],
            description: "Owner withdrawal",
            amount: round2(randomInt(50, 300)),
            paymentMethod: "CASH",
            isPersonalWithdrawal: true,
            userId: owner.id,
            expenseDate: expDate,
            createdAt: expDate,
          },
        })
      );
    }
  }

  // Rent + salaries for the current month
  const monthStart = new Date();
  monthStart.setDate(3);
  monthStart.setHours(9, 0, 0, 0);
  await withRetry(() =>
    prisma.expense.create({
      data: {
        businessId: business.id,
        categoryId: expenseCategories["Rent"],
        description: "Shop rent",
        amount: 1200,
        paymentMethod: "BANK_TRANSFER",
        userId: owner.id,
        expenseDate: monthStart,
        createdAt: monthStart,
      },
    })
  );
  await withRetry(() =>
    prisma.expense.create({
      data: {
        businessId: business.id,
        categoryId: expenseCategories["Salaries or wages"],
        description: "Staff wages",
        amount: 900,
        paymentMethod: "CASH",
        userId: owner.id,
        expenseDate: monthStart,
        createdAt: monthStart,
      },
    })
  );

  // Sync final stock quantities to the running totals used throughout the simulation
  for (const p of products) {
    await withRetry(() => prisma.product.update({ where: { id: p.id }, data: { stockQty: p.runningStock } }));
  }

  console.log("Seed complete.");
  console.log("");
  console.log("Demo accounts (all use password: " + DEMO_PASSWORD + ")");
  console.log("  Owner/Administrator : owner@kuditrack.demo");
  console.log("  Manager             : manager@kuditrack.demo");
  console.log("  Cashier              : cashier@kuditrack.demo");
  console.log("  Stock Keeper         : stockkeeper@kuditrack.demo");
  console.log("  Bookkeeper           : bookkeeper@kuditrack.demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
