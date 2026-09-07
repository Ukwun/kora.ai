import { query, postgresEnabled } from "./db";
import { readDatabase } from "./store";

export type AIIntent = "repurchase_candidates" | "unsupported";

export type RepurchaseCandidate = {
  customerId: string;
  customerName: string;
  totalRevenue: number;
  lastPurchaseAt: string;
  daysSinceLastPurchase: number;
  purchaseCount: number;
  averagePurchase: number;
  openInvoiceAmount: number;
  score: number;
  reasons: string[];
};

export type IntelligenceResult = {
  intent: AIIntent;
  generatedAt: string;
  candidates: RepurchaseCandidate[];
  dataNotice?: string;
};

export function detectBusinessIntent(question: string): AIIntent {
  const normalized = question.toLowerCase();
  if (/buy again|purchase again|repurchase|returning customer|likely to buy/.test(normalized)) {
    return "repurchase_candidates";
  }
  return "unsupported";
}

export async function getRepurchaseCandidates(organizationId: string): Promise<RepurchaseCandidate[]> {
  const rows = postgresEnabled
    ? await getPostgresCandidates(organizationId)
    : await getDevelopmentCandidates(organizationId);

  return rows
    .map((row) => scoreCandidate(row))
    .filter((candidate) => candidate.purchaseCount > 0)
    .sort((a, b) => b.score - a.score || b.totalRevenue - a.totalRevenue)
    .slice(0, 10);
}

type CandidateInput = Omit<RepurchaseCandidate, "score" | "reasons" | "daysSinceLastPurchase">;

async function getPostgresCandidates(organizationId: string): Promise<CandidateInput[]> {
  const result = await query<CandidateInput>(`
    WITH invoice_summary AS (
      SELECT
        i.customer_id,
        i.id,
        i.amount,
        i.status,
        i.created_at,
        MAX(p.received_at) FILTER (WHERE p.status = 'received') AS paid_at,
        BOOL_OR(p.status = 'received') AS has_received_payment
      FROM invoices i
      LEFT JOIN payments p ON p.invoice_id = i.id AND p.organization_id = i.organization_id
      WHERE i.organization_id = $1 AND i.customer_id IS NOT NULL
      GROUP BY i.customer_id, i.id, i.amount, i.status, i.created_at
    )
    SELECT
      c.id AS "customerId",
      c.name AS "customerName",
      COALESCE(SUM(s.amount) FILTER (WHERE s.status = 'paid' OR s.has_received_payment), 0)::float8 AS "totalRevenue",
      COALESCE(MAX(COALESCE(s.paid_at, s.created_at)) FILTER (WHERE s.status = 'paid' OR s.has_received_payment), c.created_at)::text AS "lastPurchaseAt",
      COUNT(s.id) FILTER (WHERE s.status = 'paid' OR s.has_received_payment)::int AS "purchaseCount",
      COALESCE(AVG(s.amount) FILTER (WHERE s.status = 'paid' OR s.has_received_payment), 0)::float8 AS "averagePurchase",
      COALESCE(SUM(s.amount) FILTER (WHERE s.status IN ('sent', 'overdue')), 0)::float8 AS "openInvoiceAmount"
    FROM customers c
    LEFT JOIN invoice_summary s ON s.customer_id = c.id
    WHERE c.organization_id = $1
    GROUP BY c.id, c.name, c.created_at
  `, [organizationId]);
  return result.rows;
}

async function getDevelopmentCandidates(organizationId: string): Promise<CandidateInput[]> {
  const database = await readDatabase();
  const receivedInvoiceIds = new Set(
    database.payments
      .filter((payment) => payment.organizationId === organizationId && payment.status === "received" && payment.invoiceId)
      .map((payment) => payment.invoiceId as string)
  );

  return database.customers
    .filter((customer) => customer.organizationId === organizationId)
    .map((customer) => {
      const invoices = database.invoices.filter((invoice) => invoice.organizationId === organizationId && invoice.customerId === customer.id);
      const paid = invoices.filter((invoice) => invoice.status === "paid" || receivedInvoiceIds.has(invoice.id));
      const lastPurchaseAt = paid.reduce(
        (latest, invoice) => invoice.updatedAt > latest ? invoice.updatedAt : latest,
        customer.createdAt
      );
      const totalRevenue = paid.reduce((total, invoice) => total + invoice.amount, 0);
      return {
        customerId: customer.id,
        customerName: customer.name,
        totalRevenue,
        lastPurchaseAt,
        purchaseCount: paid.length,
        averagePurchase: paid.length ? totalRevenue / paid.length : 0,
        openInvoiceAmount: invoices.filter((invoice) => invoice.status === "sent" || invoice.status === "overdue").reduce((total, invoice) => total + invoice.amount, 0),
      };
    });
}

function scoreCandidate(candidate: CandidateInput): RepurchaseCandidate {
  const lastPurchase = new Date(candidate.lastPurchaseAt).getTime();
  const daysSinceLastPurchase = Number.isFinite(lastPurchase)
    ? Math.max(0, Math.floor((Date.now() - lastPurchase) / 86_400_000))
    : 365;
  const recencyScore = daysSinceLastPurchase <= 30 ? 35 : daysSinceLastPurchase <= 60 ? 20 : 5;
  const frequencyScore = Math.min(candidate.purchaseCount * 10, 35);
  const valueScore = candidate.totalRevenue > 0 ? 20 : 0;
  const openInvoicePenalty = candidate.openInvoiceAmount > 0 ? 20 : 0;
  const score = Math.max(0, Math.min(100, recencyScore + frequencyScore + valueScore - openInvoicePenalty));
  const reasons = [
    `${candidate.purchaseCount} confirmed purchase${candidate.purchaseCount === 1 ? "" : "s"}`,
    `last purchase ${daysSinceLastPurchase} days ago`,
    `average purchase ${candidate.averagePurchase.toFixed(2)}`,
  ];
  if (candidate.openInvoiceAmount > 0) reasons.push(`open invoices total ${candidate.openInvoiceAmount.toFixed(2)}`);

  return { ...candidate, daysSinceLastPurchase, score, reasons };
}

export async function answerBusinessQuestion(organizationId: string, question: string): Promise<IntelligenceResult> {
  const intent = detectBusinessIntent(question);
  if (intent === "unsupported") {
    return { intent, generatedAt: new Date().toISOString(), candidates: [], dataNotice: "Kora can currently answer repurchase-candidate questions from confirmed customer, invoice, and payment records." };
  }
  const candidates = await getRepurchaseCandidates(organizationId);
  return {
    intent,
    generatedAt: new Date().toISOString(),
    candidates,
    dataNotice: candidates.length ? undefined : "There is not enough confirmed purchase history yet to rank repurchase candidates.",
  };
}
