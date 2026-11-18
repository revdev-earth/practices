// Where a person lands after logging in.
export const HOME_PATH = '/calendar'

// Full address of a page, for emails, calendar files and the summary people paste in other apps.
export const absoluteUrl = (path: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}${path}`

export const practicePath = (practiceId: string) => `/practices/${practiceId}`
export const roomPath = (practiceId: string) => `/practices/${practiceId}/room`
export const sharePath = (practiceId: string) => `/share/${practiceId}`
export const pollPath = (pollId: string) => `/polls/${pollId}`

// The link that works for everyone who receives it: the public page when there is one, else the page behind the login.
export const shareablePracticePath = ({ id, isPublic }: { id: string; isPublic: boolean }) => (isPublic ? sharePath(id) : practicePath(id))

// Only internal paths are accepted, so a tampered link cannot take anyone off the site after login.
export const safeNextPath = (next: unknown): string => {
  if (typeof next !== 'string') return HOME_PATH
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return HOME_PATH
  return next
}

// Login, registration and password recovery open as a window on top of the landing page.
// The address carries which one is open, so a link, the back button and a reload all agree.
export const AUTH_VIEWS = ['login', 'register', 'forgot', 'reset'] as const
export type AuthView = (typeof AUTH_VIEWS)[number]

export const AUTH_VIEW_PARAM = 'auth'

export const parseAuthView = (value: unknown): AuthView | null => (AUTH_VIEWS.includes(value as AuthView) ? (value as AuthView) : null)

export const authModalPath = (view: AuthView, { next, token }: { next?: string | null; token?: string | null } = {}) => {
  const params = new URLSearchParams({ [AUTH_VIEW_PARAM]: view })
  if (next) params.set('next', next)
  if (token) params.set('token', token)
  return `/?${params.toString()}`
}

// The calendar shows a month or a week. It opens on a month, or on a day, which also selects the month or the week that holds it.
export const CALENDAR_VIEWS = ['month', 'week'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

export const calendarPath = ({ view = 'month', month, day }: { view?: CalendarView; month?: string; day?: string } = {}) => {
  const params = new URLSearchParams()
  if (view === 'week') params.set('view', 'week')
  if (day) params.set('day', day)
  else if (month && view === 'month') params.set('month', month)
  const query = params.toString()
  return query ? `/calendar?${query}` : '/calendar'
}
