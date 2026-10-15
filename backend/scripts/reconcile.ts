import { reconcileRepositories } from "../src/services/reconcile.js";

const result = await reconcileRepositories();
process.stdout.write(`${JSON.stringify(result)}\n`);
