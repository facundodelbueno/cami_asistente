const weekdayByName = new Map([
  ["domingo", 0],
  ["lunes", 1],
  ["martes", 2],
  ["miercoles", 3],
  ["miércoles", 3],
  ["jueves", 4],
  ["viernes", 5],
  ["sabado", 6],
  ["sábado", 6]
]);

export function formatDateTimeAr(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

export function formatShortDateTimeAr(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(date)
    .replace(",", " a las");
}

export function getPaymentReminderAt(sessionDate: Date, reminderHour = 10) {
  const sessionParts = toBuenosAiresDateParts(sessionDate);
  const reminderLocal = new Date(
    Date.UTC(sessionParts.year, sessionParts.month - 1, sessionParts.day - 2, reminderHour + 3, 0, 0, 0)
  );
  const reminderWeekday = getBuenosAiresWeekday(reminderLocal);

  if (reminderWeekday === 6) {
    return addDays(reminderLocal, -1);
  }

  if (reminderWeekday === 0) {
    return addDays(reminderLocal, -2);
  }

  return reminderLocal;
}

export function parseLocalDateReference(text: string, now = new Date()): Date | null {
  const lower = normalizeText(text);
  const hourMatch = lower.match(/(?:a las|las)\s+(\d{1,2})(?::(\d{2}))?/);
  if (!hourMatch) return null;

  const hour = Number(hourMatch[1]);
  const minute = hourMatch[2] ? Number(hourMatch[2]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;

  const base = toBuenosAiresDateParts(now);
  let target = new Date(Date.UTC(base.year, base.month - 1, base.day, hour + 3, minute, 0, 0));

  if (lower.includes("manana")) {
    target = addDays(target, 1);
    return target;
  }

  for (const [name, weekday] of weekdayByName.entries()) {
    if (!lower.includes(name)) continue;
    const currentWeekday = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Argentina/Buenos_Aires",
        weekday: "short"
      })
        .format(now)
        .replace("Sun", "0")
        .replace("Mon", "1")
        .replace("Tue", "2")
        .replace("Wed", "3")
        .replace("Thu", "4")
        .replace("Fri", "5")
        .replace("Sat", "6")
    );
    const diff = (weekday - currentWeekday + 7) % 7 || 7;
    return addDays(target, diff);
  }

  return target;
}

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/Ã¡/g, "a")
    .replace(/Ã©/g, "e")
    .replace(/Ã­/g, "i")
    .replace(/Ã³/g, "o")
    .replace(/Ãº/g, "u")
    .replace(/Ã±/g, "n")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function nextBuenosAiresDailyRun(now: Date, hour: number) {
  const parts = toBuenosAiresDateParts(now);
  const todayRun = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour + 3, 0, 0, 0));
  if (todayRun > now && isBuenosAiresBusinessDay(todayRun)) {
    return todayRun;
  }

  let nextRun = addDays(todayRun, 1);
  while (!isBuenosAiresBusinessDay(nextRun)) {
    nextRun = addDays(nextRun, 1);
  }
  return nextRun;
}

export function isBuenosAiresBusinessDay(date: Date) {
  const weekday = getBuenosAiresWeekday(date);
  return weekday !== 0 && weekday !== 6;
}

function getBuenosAiresWeekday(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "short"
  }).format(date);

  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function toBuenosAiresDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day")
  };
}
