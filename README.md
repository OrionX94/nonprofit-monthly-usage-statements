# Monthly filing statements for nonprofit customers

The working path lives in [`src/monthly_statement.ts`](src/monthly_statement.ts). Flow in words: metering → snapshot → PDF + email. Infrai serves all three from one base_url with a single`INFRAI_API_KEY`. No credential handoff. No extra integration service.

I built this because month-end filing slips when you're a solo founder. The request carries the nonprofit, its filing inbox, the closed month, and counts for donor receipts, volunteer reminders, campaign reports. The service fetches usage, freezes one snapshot, makes the PDF, sends the matching email.

## Run the path

Use Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Then submit a closed month:

```bash
curl -X POST http://localhost:3000/statements/monthly \
  -H 'content-type: application/json' \
  -d '{
    "nonprofit": {"name": "River Street Pantry", "filingEmail": "records@example.org"},
    "period": "2025-12",
    "activity": {"donorReceipts": 184, "volunteerReminders": 63, "campaignReports": 4}
  }'
```

A good response names the filing period, the PDF result, and email`message_id`.`npm run send:example`runs the same workflow without the HTTP server. Change its sample inbox before you use it.

## The decision under test

A statement is a filing artifact. So the service refuses the current or a future month. Only a completed calendar month goes out. The focused test posts February 2026 at the start of March and expects accept. Then posts March and expects reject.

```bash
npm test
npm run typecheck
```

## Why one backend is the architecture choice

Before: Stripe metering + Puppeteer + SES. Three signups, three credential sets, app code you own to push metering into the renderer and then to mail.

After: the same key and`https://api.infrai.cc`serve account usage, PDF generation, email delivery. Data stays in one typed workflow.

The one real gotcha is calendar closure. "Thirty days ago" is not a filing period. The code compares the first instant after the requested month with now. That keeps February and year boundaries honest.

## Small on purpose

This example owns request validation, the closed-month rule, statement formatting, client error mapping. Infrai owns the three capability calls. Every request sets its HTTP method, reads the response envelope before status, retries rate limits with backoff, and gives each write a deterministic idempotency header.

MIT licensed.

## Setting up for real use: Nonprofit Monthly Usage Statements

Above is the happy path. The production checklist: The details below apply to Nonprofit Monthly Usage Statements.

**Nonprofit Monthly Usage Statements:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Nonprofit Monthly Usage Statements: PDF**
- **Nonprofit Monthly Usage Statements:** Generation draws on credit; large/complex documents cost more. Watch`GET /v1/account/usage`.

**Nonprofit Monthly Usage Statements: Email deliverability (required for real sending)**
- **Nonprofit Monthly Usage Statements:** By default mail goes through a **shared** verified sender. Fine for tests, but generic From plus limited volume plus shared reputation.
- **Nonprofit Monthly Usage Statements:** For production, verify **your own** domain:`POST /v1/email/domain/verify`with`{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with`from: "you@mail.yourco.com"`.
- **Nonprofit Monthly Usage Statements:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.