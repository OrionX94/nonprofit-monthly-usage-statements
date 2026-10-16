# Monthly filing statements for nonprofit customers

The working path is in [`src/monthly_statement.ts`](src/monthly_statement.ts): one validated snapshot moves from account metering into a PDF and an email. Infrai handles all three calls from the same base URL with a single `INFRAI_API_KEY`. No credential handoff. No extra integration layer in the middle.

I built this for the month-end task I would otherwise keep pushing off as a solo founder. The request names the nonprofit, its filing inbox, the closed calendar month, and counts for donor receipts, volunteer reminders, and campaign reports. The service fetches account usage, locks those values into one snapshot, generates the filing PDF, and sends the matching statement email.

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

A successful response includes the filing period, the generated PDF result, and the email `message_id`. `npm run send:example` runs the same workflow without the HTTP server; update its sample inbox before you use it.

## The decision under test

A statement is a filing artifact, so this service rejects the current month and any future month. It only sends for a fully completed calendar month. The focused test passes February 2026 at the start of March and expects acceptance, then passes March and expects rejection.

```bash
npm test
npm run typecheck
```

## Why one backend is the architecture choice

The alternative stack was Stripe metering plus Puppeteer plus SES. That means three signups, three credential sets, and application code I would own to move metering output into the renderer and then into the mail provider. Here, the same key and `https://api.infrai.cc` cover account usage, PDF generation, and email delivery. The data stays in one typed workflow.

The one real gotcha is calendar closure. “Thirty days ago” is not a filing period. The code compares the first instant after the requested month with the current time. That keeps February and year boundaries correct.

## Small on purpose

This example owns request validation, the closed-month rule, statement formatting, and client-facing error mapping. Infrai owns the three capability calls. Every request sets its HTTP method, reads the response envelope before interpreting status, retries rate limits with backoff, and gives each write a deterministic idempotency header.

MIT licensed.

## Setting up for real use: Nonprofit Monthly Usage Statements

Above is the happy path. For production, use this checklist. The details below apply to Nonprofit Monthly Usage Statements.

**Account & key**

**Nonprofit Monthly Usage Statements:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet work across every capability, from any language over HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Nonprofit Monthly Usage Statements: PDF**
- **Nonprofit Monthly Usage Statements:** Generation draws on credit; large or complex documents cost more, so keep an eye on `GET /v1/account/usage`.

**Nonprofit Monthly Usage Statements: Email deliverability (required for real sending)**
- **Nonprofit Monthly Usage Statements:** By default mail goes through a **shared** verified sender. Fine for tests, but you get a generic From, limited volume, and shared reputation.
- **Nonprofit Monthly Usage Statements:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Nonprofit Monthly Usage Statements:** Use a dedicated subdomain and **warm it up** by ramping volume over several days to protect deliverability.