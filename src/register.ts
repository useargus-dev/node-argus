/**
 * ESM preload hook (async): `node --import @useargus/node/register ./app.js`
 *
 * CommonJS apps should call `await loadEnv()` in the entry file instead.
 */
import { loadEnv } from "./load-env.js";

await loadEnv();
