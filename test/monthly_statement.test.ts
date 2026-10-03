import assert from "node:assert/strict";
import test from "node:test";
import { assertClosedMonth, StatementRequest } from "../src/monthly_statement.js";

test("accepts a complete filing month and rejects the current month", () => {
  const request = StatementRequest.parse({
    nonprofit: { name: "River Street Pantry", filingEmail: "records@example.org" },
    period: "2026-02",
    activity: { donorReceipts: 12, volunteerReminders: 7, campaignReports: 1 },
  });
  assert.doesNotThrow(() => assertClosedMonth(request.period, new Date("2026-03-01T00:00:00Z")));
  assert.throws(
    () => assertClosedMonth("2026-03", new Date("2026-03-18T12:00:00Z")),
    /completed calendar month/,
  );
});
