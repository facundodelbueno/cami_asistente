export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, "");
}

export function samePhone(a: string, b: string) {
  return normalizePhone(a) === normalizePhone(b);
}
