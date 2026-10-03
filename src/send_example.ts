import { InfraiClient } from "./infrai_client.js";
import { sendMonthlyStatement, StatementRequest } from "./monthly_statement.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before running the example");

const input = StatementRequest.parse({
  nonprofit: { name: "River Street Pantry", filingEmail: "records@example.org" },
  period: "2025-12",
  activity: { donorReceipts: 184, volunteerReminders: 63, campaignReports: 4 },
});

console.log(await sendMonthlyStatement(input, new InfraiClient(apiKey)));
