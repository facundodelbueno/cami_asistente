import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startLocalScheduler } from "./jobs/scheduler.js";
import { logger } from "./utils/logger.js";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info(`Cami Assistant listening on port ${env.PORT}`);
  startLocalScheduler();
});
