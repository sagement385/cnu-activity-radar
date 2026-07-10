import { runDigest } from "../lib/digest";
import type { DigestPeriod } from "../lib/types";

const period = (process.argv[2] ?? "manual") as DigestPeriod;

runDigest(period)
  .then((result) => {
    console.log(result.message);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
