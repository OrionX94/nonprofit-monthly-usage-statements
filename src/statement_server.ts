import { createServer } from "node:http";
import { ZodError } from "zod";
import { InfraiClient, InfraiError } from "./infrai_client.js";
import { sendMonthlyStatement, StatementRequest } from "./monthly_statement.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const client = new InfraiClient(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/statements/monthly") {
    return json(response, 404, { error: "Route not found" });
  }
  try {
    const input = StatementRequest.parse(await readJson(request));
    return json(response, 201, await sendMonthlyStatement(input, client));
  } catch (error) {
    if (error instanceof ZodError) return json(response, 400, { error: "Invalid request", issues: error.issues });
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      return json(response, status, { error: error.code });
    }
    if (error instanceof SyntaxError) return json(response, 400, { error: "Malformed JSON" });
    return json(response, 422, { error: error instanceof Error ? error.message : "Statement rejected" });
  }
}).listen(port, () => console.log(`Statement service listening on http://localhost:${port}`));

async function readJson(request: AsyncIterable<Buffer | string>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
