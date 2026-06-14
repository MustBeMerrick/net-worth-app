import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import { createInterface } from "readline";
import { randomUUID } from "crypto";
import { homedir } from "os";
import { join } from "path";

const prisma = new PrismaClient();

function cents(dollars) {
  const [whole, frac = ""] = parseFloat(dollars).toFixed(2).split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}

// Parse MM/DD/YYYY → ISO date string
function parseDate(str) {
  const [m, d, y] = str.split("/");
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00.000Z`);
}

const csvPath = join(homedir(), "Desktop", "401k_contributions_by_date.csv");

const rl = createInterface({ input: createReadStream(csvPath) });

let headers = null;
const rows = [];

for await (const line of rl) {
  if (!headers) {
    headers = line.split(",");
    continue;
  }
  const cols = line.split(",");
  const row = Object.fromEntries(headers.map((h, i) => [h, cols[i]]));
  if (row.contribution_type === "Enhanced Contribution") continue;
  rows.push(row);
}

console.log(`Importing ${rows.length} contributions (Enhanced Contribution excluded)...`);

let inserted = 0;
for (const row of rows) {
  const date = parseDate(row.trade_date);
  const amountCents = cents(row.total_amount);
  const id = `contrib-fidelity-csv-${row.trade_date.replace(/\//g, "-")}-${row.contribution_type.replace(/\s+/g, "-").toLowerCase()}-${randomUUID().slice(0, 8)}`;

  await prisma.contribution.create({
    data: {
      id,
      accountId: "fidelity-401k",
      contributionDate: date,
      amountCents,
      kind: "contribution",
      note: row.contribution_type,
      source: "pdf_import",
    },
  });
  inserted++;
  console.log(`  ${row.trade_date}  ${row.contribution_type.padEnd(20)}  $${row.total_amount}`);
}

console.log(`\nDone. Inserted ${inserted} contributions.`);
await prisma.$disconnect();
