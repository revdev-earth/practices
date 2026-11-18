# Goal

## Original request

The request was written in Spanish. This is a faithful translation.

> Taking properties as the reference, let's build the whole app for practices. It should not be shaped by the hypnosis theme, it is for practices in general. You can decide how many participants are needed at minimum and how many at maximum, with a description and a title. We will use Turso, login, register and the rest we already know from properties, where we have a lot of experience. Let's see how far we get, using Next.js and Tailwind. Do we need Redux?
>
> It also has to take into account that people are in different time zones.

A later instruction added that the application and its documentation are written in English.

A second request, on 2026-11-16, changed how people get in. This is a faithful translation.

> Instead of having pages for register, login and reset password, it has to be a modal with a nice transition when it opens and closes. When someone logs in they go to the calendar, I hope there is one, and I hope we also added the email confirmation. Let's look at properties to see how they have it.

## What the app is

Practices is an app for organizing group practice sessions on any topic. One person posts a practice with a date, a duration and a group size. Others join. Once the minimum is reached the practice is confirmed. Once the maximum is reached, whoever joins next goes on the waitlist and moves up when someone leaves.

The starting prototype is `Práctica de hipnosis · Grupos de 4.html` in the repo root. It had a hypnosis theme and a fixed group of 4. The new app is generic and the organizer decides the group size.

## What we expect

Every practice has a title, a description, a date and time, a duration, a mode (online or in person), a link or place, a minimum number of participants and a maximum number of participants.

Anyone with an account can post, join and leave. The organizer can edit and delete their own practice.

There is registration with email confirmation, login, logout and password recovery by email. All of them happen in one window that opens on top of the landing page.

After logging in a person lands on a calendar of the month with every practice on its day.

Each person sees times in their own time zone, with the zone written next to the time to avoid confusion across countries.

The database is SQLite locally and Turso in staging and production, with the same Prisma schema.

## Decisions made

Redux stays out. Data is read in Server Components and changed with Server Actions and `useActionState`. The session lives in a Better Auth cookie. The little client state that remains is covered by `useState`. Properties keeps the state of its login modal in Redux. Here the address of the page does that job.

Authentication uses Better Auth with email and password and exposes no HTTP routes of its own. Everything goes through Server Actions that call `authServer.api`.

Login, registration, the email code and password recovery are steps of a single window on the landing page, as in properties. The address says which step is open, for example `/?auth=login`. That makes links from emails, the back button and a reload agree with what is on screen.

A new account stays closed until the person types a 6 digit code sent to its email, as in properties. The code works for 15 minutes and allows three tries. A new code can be requested once a minute. Typing the right code also opens the session.

Confirming an email asks for the code and for the password of the account. The code proves who reads the inbox and the password proves who created the account. Without the second check, someone could register a stranger's email and wait for the owner to confirm it.

An account that never typed its code owns nothing. Registering the same email again starts it over with the new password.

Registering an email that already has a confirmed account answers that the account exists. The answer tells whether an email is registered, which is the same trade properties makes for a clearer message.

There is a single kind of user. Permissions come from the relation to each practice, organizer or participant.

Whoever posts a practice takes the first spot on the list.

The calendar is the home of the app. The list with its filters stays one click away in the header.

A practice belongs to the day it starts on in the viewer's zone. The same practice can sit on Wednesday for one person and on Thursday for another.

Weeks run from Monday to Sunday, the international standard, in line with the 24 hour clock.

Everything is in English, including the interface, routes, code, comments and docs.

Dates are formatted with the `en-US` locale and a 24 hour clock, which reads the same in every country.

A third request, on 2026-11-17, asked for rooms inside the app. Online practices can use a room of their own, built with LiveKit as in the `lives` project, or an external link. Only people with a confirmed spot enter. The room opens 15 minutes before the start and closes when the practice ends.

A fourth request, on 2026-11-18, asked for public and private practices. A public practice has a page that anyone can open from a shared link with no account. If it has a room, a guest enters the call by typing a name and takes no spot on the sheet. A private practice needs an account. New practices are private. Guests have 10 extra places in the room.

On 2026-11-18 the work went on with the ideas for later, one after another, while the owner was away. These came out of it.

A practice can be added to Google Calendar or downloaded as an `.ics` file for Apple Calendar, Outlook and the rest.

Logging in, asking for a reset link and creating accounts have limits per email and per address.

The calendar has a week view next to the month.

People get an email when their practice is confirmed, when they move up from the waitlist, when the host moves the time and when the host cancels. Moving the time and cancelling were not in the list of ideas. They use the same mechanism and keep people from showing up at the wrong time.

The host of a call splits the people into groups of a chosen size, moves people between them, visits any group and brings everyone back, as the idea described.

Each person in a video room chooses how it looks: a grid with as many people as fit or a fixed number per screen, a speaker view, or one person pinned.

The walk through became Playwright tests in `e2e/`.

A fifth request, on 2026-11-18, asked for two things. This is a faithful translation.

> We also want polls to find out which times would be best for the practice, and when a practice starts the room is only removed when someone decides, not when the time runs out.

The answers to the questions that followed set the shape. The poll comes before the practice: the host proposes times, people answer, and the host posts the practice at the chosen time. Anyone with the link answers, with an account or with just a name. Each time takes yes, if needed or no. Once the time of the practice is up, the room stays while people are in it, until the host ends the call or a few minutes after the last person leaves.

A sixth request, on 2026-11-19, after the first deploy, asked for a share button on the practice, a visible way to reach the polls when posting a practice, and polls that ask for dates. This is a faithful translation.

> And since it gets shared, it's missing the share button, and when I created it I saw nothing about making a poll of which times suit best, and it could also ask which dates are preferable.

A poll now asks for times or for days. In a poll of days the host picks the hour when posting the practice.

## Ideas for later

Recording a session from the video room. The host decides to record, with no vote from the group. A visible notice tells everyone while it runs. Whoever does not agree can leave the call, or tell the host, and their image is not kept. LiveKit offers recording through egress, which needs storage for the files.

Per participant roles or preferences, like the guide and subject roles in the prototype.

A reminder email shortly before a practice starts. It needs a scheduled job, such as a Vercel cron.
