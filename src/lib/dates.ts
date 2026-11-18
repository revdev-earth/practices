// Date formatting for one specific time zone. It runs on the server with the zone the browser leaves in a cookie
// (see TimezoneSync), so the server and the browser never show different times.
const LOCALE = 'en-US'

export const TIME_ZONE_COOKIE = 'tz'
export const DEFAULT_TIME_ZONE = 'America/Bogota'

const format = (date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone, ...options }).format(date)

// 24 hour clock, which reads the same in every country.
export const formatTime = (date: Date, timeZone: string) => format(date, timeZone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// "Thursday, November 19". Adds the year when it is not the current one.
export const formatLongDate = (date: Date, timeZone: string, now = new Date()) => {
  const sameYear = format(date, timeZone, { year: 'numeric' }) === format(now, timeZone, { year: 'numeric' })
  return format(date, timeZone, { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
}

// "GMT-5": spells out the zone when the time is shared with people in other countries.
export const formatZone = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone, timeZoneName: 'short' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ??
  timeZone

// "America/Argentina/Buenos_Aires" reads as "Buenos Aires".
export const formatZoneCity = (timeZone: string) => (timeZone.split('/').pop() ?? timeZone).replaceAll('_', ' ')

// "Thu, Nov 26, 19:00", where a table has little room.
export const formatShortDateTime = (date: Date, timeZone: string) =>
  `${format(date, timeZone, { weekday: 'short', month: 'short', day: 'numeric' })}, ${formatTime(date, timeZone)}`

export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

// Value for <input type="datetime-local"> with the wall clock time of that zone.
export const toDateTimeLocal = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}

// Calendar day of an instant in that zone, as "2026-11-19". Two instants share a day when their keys match.
export const dayKey = (date: Date, timeZone: string) => toDateTimeLocal(date, timeZone).slice(0, 10)

// A day key is a plain calendar date. Its arithmetic runs in UTC, where no day is ever skipped or repeated.
const dayKeyToUtc = (key: string) => new Date(`${key}T00:00:00Z`)
const utcToDayKey = (date: Date) => date.toISOString().slice(0, 10)

export const isDayKey = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(dayKeyToUtc(value).getTime()) &&
  utcToDayKey(dayKeyToUtc(value)) === value

export const shiftDayKey = (key: string, days: number) => {
  const day = dayKeyToUtc(key)
  day.setUTCDate(day.getUTCDate() + days)
  return utcToDayKey(day)
}

// "Today, Thursday, November 19". Days further away keep the long date alone. The year shows when it is not the current one.
export const formatDayKeyHeading = (day: string, today: string) => {
  const sameYear = day.slice(0, 4) === today.slice(0, 4)
  const longDate = format(dayKeyToUtc(day), 'UTC', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
  if (day === today) return `Today, ${longDate}`
  if (day === shiftDayKey(today, 1)) return `Tomorrow, ${longDate}`
  return longDate
}

// "Thursday, November 26" for a calendar day that means the same date for everyone. The year shows when it is not the current one.
export const formatDayKey = (day: string, today: string) => {
  const sameYear = day.slice(0, 4) === today.slice(0, 4)
  return format(dayKeyToUtc(day), 'UTC', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
}

// "Thu, Nov 26", where a table has little room.
export const formatShortDayKey = (day: string) => format(dayKeyToUtc(day), 'UTC', { weekday: 'short', month: 'short', day: 'numeric' })

export const formatDayHeading = (date: Date, timeZone: string, now = new Date()) => formatDayKeyHeading(dayKey(date, timeZone), dayKey(now, timeZone))

// Calendar months. A month is written as "2026-11", in the viewer's zone like the day keys.
export const monthKey = (day: string) => day.slice(0, 7)

export const isMonthKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)

export const shiftMonthKey = (month: string, months: number) => {
  const firstDay = dayKeyToUtc(`${month}-01`)
  firstDay.setUTCMonth(firstDay.getUTCMonth() + months)
  return monthKey(utcToDayKey(firstDay))
}

// "November 2026"
export const formatMonthHeading = (month: string) => format(dayKeyToUtc(`${month}-01`), 'UTC', { month: 'long', year: 'numeric' })

// The weeks run from Monday to Sunday, the international standard, in line with the 24 hour clock.
const KNOWN_MONDAY = '2024-01-01'
export const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const day = dayKeyToUtc(shiftDayKey(KNOWN_MONDAY, index))
  return { short: format(day, 'UTC', { weekday: 'short' }), long: format(day, 'UTC', { weekday: 'long' }) }
})

// The weeks a month page shows. The first and the last one are completed with days of the neighboring months.
export const calendarWeeks = (month: string): string[][] => {
  const firstDay = dayKeyToUtc(`${month}-01`)
  const daysBeforeTheFirst = (firstDay.getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate()
  const weekCount = Math.ceil((daysBeforeTheFirst + daysInMonth) / 7)
  const firstDayShown = shiftDayKey(`${month}-01`, -daysBeforeTheFirst)

  return Array.from({ length: weekCount }, (_, week) => Array.from({ length: 7 }, (_, weekday) => shiftDayKey(firstDayShown, week * 7 + weekday)))
}

// The Monday of the week that holds the day.
export const weekStartDayKey = (day: string) => shiftDayKey(day, -((dayKeyToUtc(day).getUTCDay() + 6) % 7))

// The seven days of the week that holds the day, Monday first.
export const weekDayKeys = (day: string) => Array.from({ length: 7 }, (_, index) => shiftDayKey(weekStartDayKey(day), index))

// "November 16 to 22, 2026", "November 30 to December 6, 2026" or "December 28, 2026 to January 3, 2027".
export const formatWeekHeading = (firstDay: string, lastDay: string) => {
  const dayOf = (key: string, options: Intl.DateTimeFormatOptions) => format(dayKeyToUtc(key), 'UTC', options)
  const sameYear = firstDay.slice(0, 4) === lastDay.slice(0, 4)
  if (!sameYear)
    return `${dayOf(firstDay, { month: 'long', day: 'numeric', year: 'numeric' })} to ${dayOf(lastDay, { month: 'long', day: 'numeric', year: 'numeric' })}`
  const end = monthKey(firstDay) === monthKey(lastDay) ? dayOf(lastDay, { day: 'numeric' }) : dayOf(lastDay, { month: 'long', day: 'numeric' })
  return `${dayOf(firstDay, { month: 'long', day: 'numeric' })} to ${end}, ${lastDay.slice(0, 4)}`
}

// "Thu 19", the label of a day in the header of the week.
export const formatWeekdayAndDay = (day: string) => `${format(dayKeyToUtc(day), 'UTC', { weekday: 'short' })} ${Number(day.slice(8))}`

// Minutes since midnight on the wall clock of that zone, as the week sheet draws them.
export const minutesIntoDay = (date: Date, timeZone: string) => {
  const wallClock = toDateTimeLocal(date, timeZone)
  return Number(wallClock.slice(11, 13)) * 60 + Number(wallClock.slice(14, 16))
}

const HOUR_MS = 60 * 60 * 1000

// A stretch of UTC time that contains those calendar days in every time zone on Earth, from UTC+14 to UTC-12.
// The calendar reads it from the database and then keeps the practices whose day, in the viewer's zone, is on the page.
export const utcWindowCoveringDays = (firstDay: string, lastDay: string) => ({
  from: new Date(dayKeyToUtc(firstDay).getTime() - 14 * HOUR_MS),
  to: new Date(dayKeyToUtc(shiftDayKey(lastDay, 1)).getTime() + 12 * HOUR_MS),
})
