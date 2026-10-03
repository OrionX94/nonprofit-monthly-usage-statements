import { createHash } from "node:crypto";
import { z } from "zod";
import { InfraiClient } from "./infrai_client.js";

export const StatementRequest = z.object({
  nonprofit: z.object({
    name: z.string().min(1),
    filingEmail: z.string().email(),
  }),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  activity: z.object({
    donorReceipts: z.number().int().nonnegative(),
    volunteerReminders: z.number().int().nonnegative(),
    campaignReports: z.number().int().nonnegative(),
  }),
});

export type StatementInput = z.infer<typeof StatementRequest>;

export function assertClosedMonth(period: string, now: Date): void {
  const [year, month] = period.split("-").map(Number);
  const monthAfter = new Date(Date.UTC(year, month, 1));
  if (monthAfter.getTime() > now.getTime()) {
    throw new Error("A filing statement can only cover a completed calendar month");
  }
}

export async function sendMonthlyStatement(input: StatementInput, client: InfraiClient, now = new Date()) {
  assertClosedMonth(input.period, now);
  const usage = await client.accountUsage();
  const snapshot = { ...input, meteredUsage: usage };
  const key = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const markdown = statementMarkdown(snapshot);
  const pdf = await client.generatePdf(markdown, `statement-pdf-${key}`);
  const email = await client.sendEmail(
    input.nonprofit.filingEmail,
    `${input.period} usage statement — ${input.nonprofit.name}`,
    statementHtml(snapshot),
    `statement-email-${key}`,
  );
  return { period: input.period, pdf, message_id: email.message_id };
}

function statementMarkdown(snapshot: StatementInput & { meteredUsage: unknown }): string {
  const { nonprofit, period, activity, meteredUsage } = snapshot;
  return `# ${escapeMarkdown(nonprofit.name)} monthly usage statement\n\n` +
    `Filing period: ${period}\n\n` +
    `- Donor receipts: ${activity.donorReceipts}\n` +
    `- Volunteer reminders: ${activity.volunteerReminders}\n` +
    `- Campaign reports: ${activity.campaignReports}\n\n` +
    `## Metered account usage\n\n\`\`\`json\n${JSON.stringify(meteredUsage, null, 2)}\n\`\`\``;
}

function statementHtml(snapshot: StatementInput & { meteredUsage: unknown }): string {
  const { nonprofit, period, activity, meteredUsage } = snapshot;
  return `<h1>${escapeHtml(nonprofit.name)} monthly usage statement</h1>` +
    `<p>Filing period: ${period}</p>` +
    `<ul><li>Donor receipts: ${activity.donorReceipts}</li>` +
    `<li>Volunteer reminders: ${activity.volunteerReminders}</li>` +
    `<li>Campaign reports: ${activity.campaignReports}</li></ul>` +
    `<h2>Metered account usage</h2><pre>${escapeHtml(JSON.stringify(meteredUsage, null, 2))}</pre>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] as string);
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+.!-]/g, "\\$&");
}
