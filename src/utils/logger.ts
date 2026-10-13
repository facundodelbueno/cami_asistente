export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    const clean = sanitize(meta);
    clean ? console.info(message, clean) : console.info(message);
  },
  warn(message: string, meta?: Record<string, unknown>) {
    const clean = sanitize(meta);
    clean ? console.warn(message, clean) : console.warn(message);
  },
  error(message: string, meta?: Record<string, unknown>) {
    const clean = sanitize(meta);
    clean ? console.error(message, clean) : console.error(message);
  }
};

function sanitize(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  const blocked = new Set(["rawText", "body", "prompt", "token", "apiKey", "authorization"]);
  return Object.fromEntries(Object.entries(meta).filter(([key]) => !blocked.has(key)));
}
