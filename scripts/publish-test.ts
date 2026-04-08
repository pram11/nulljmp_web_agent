import { publisher } from "../src/queue/publisher";

async function main() {
  await publisher.publish({
    job_id: "test-001",
    actions: [
      { type: "goto", params: { url: "https://www.nytimes.com" } },
      { type: "extract", params: { selector: "h1", attr: "innerText" } },
    ],
  });
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
