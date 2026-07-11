const KOREAN_DAY_ORDER = ["일", "월", "화", "수", "목", "금", "토"];

export function todayKst() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
}

export function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function daysUntil(dateText?: string | null) {
  if (!dateText) {
    return null;
  }

  const target = new Date(`${dateText}T23:59:59+09:00`);
  const now = todayKst();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function extractKoreanDate(text: string) {
  const normalized = text.replace(/\s+/g, " ");
  const match = normalized.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractDeadline(text: string) {
  const labelledMatch = text.match(/(?:마감(?:일)?|접수(?:기간)?(?=\s*[:：]?\s*20)|모집기간|신청(?:기간)?(?=\s*[:：]?\s*20)|지원기간|서류접수)[\s\S]{0,180}/i);
  if (labelledMatch) {
    const scope = labelledMatch[0].split(/(?:운영기간|활동기간|교육기간|행사기간|파견기간)/i)[0];
    const rangeMatch = scope.match(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})[^0-9]{0,20}(?:~|부터)[^0-9]{0,12}(?:(20\d{2})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})/i);
    if (rangeMatch) {
      const [, startYear, , , endYear, endMonth, endDay] = rangeMatch;
      return makeDate(endYear || startYear, endMonth, endDay);
    }

    const fullDates = [...scope.matchAll(/(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/g)];
    if (fullDates.length) {
      const match = fullDates[fullDates.length - 1];
      return makeDate(match[1], match[2], match[3]);
    }
  }

  const patterns = [
    /(?:~|까지)[^0-9]{0,10}(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/i,
    /(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})[^0-9]{0,10}(?:까지|마감)/i,
    /(?:~|까지|마감)[^0-9]{0,8}(\d{1,2})[.\-/월]\s*(\d{1,2})/i,
    /(\d{1,2})[.\-/월]\s*(\d{1,2})[^0-9]{0,8}(?:까지|마감)/i
  ];

  const shortYearMatch = text.match(/(?:~|까지|마감)[^0-9]{0,8}[']?(\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/i);
  if (shortYearMatch) {
    const [, shortYear, month, day] = shortYearMatch;
    return makeDate(`20${shortYear}`, month, day);
  }

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match) {
      const [, first, second, third] = match;
      const year = third ? first : `${todayKst().getFullYear()}`;
      const month = third ? second : first;
      const day = third ? third : second;
      return makeDate(year, month, day);
    }
  }

  return null;
}

function makeDate(year: string, month: string, day: string) {
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > 31) {
    return null;
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function extractDays(text: string) {
  return KOREAN_DAY_ORDER.filter((day) => text.includes(`${day}요일`) || text.includes(day));
}

export function isExpired(dateText?: string | null) {
  const remaining = daysUntil(dateText);
  return remaining !== null && remaining < 0;
}
