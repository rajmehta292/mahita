export function getEasternDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    weekday: lookup.weekday,
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
  }
}

export function isUsEquityMarketOpen(date = new Date()) {
  const { weekday, hour, minute } = getEasternDateParts(date)
  if (weekday === "Sat" || weekday === "Sun") {
    return false
  }

  const totalMinutes = hour * 60 + minute
  const marketOpen = 9 * 60 + 30
  const marketClose = 16 * 60
  return totalMinutes >= marketOpen && totalMinutes < marketClose
}

export function isAfterHoursWindow(date = new Date()) {
  return !isUsEquityMarketOpen(date)
}
