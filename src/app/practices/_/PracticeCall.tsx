'use client'

import {
  CarouselLayout,
  Chat,
  ConnectionStateToast,
  ControlBar,
  FocusLayout,
  FocusLayoutContainer,
  GridLayout,
  isTrackReference,
  LayoutContextProvider,
  ParticipantTile,
  RoomAudioRenderer,
  useCreateLayoutContext,
  usePinnedTracks,
  useTracks,
  type TrackReferenceOrPlaceholder,
  type WidgetState,
} from '@livekit/components-react'
import { RoomEvent, Track } from 'livekit-client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'

// How the call is drawn. Each person picks their own and the browser remembers it.
// grid: everyone the same size, a page at a time. speaker: whoever spoke last fills the screen and the rest wait in a strip.
const LAYOUTS = ['grid', 'speaker'] as const
type CallLayout = (typeof LAYOUTS)[number]

const LAYOUT_LABELS: Record<CallLayout, string> = { grid: 'Grid', speaker: 'Speaker' }

// People on one page of the grid. Auto lets the grid fit as many as the screen allows.
const PEOPLE_PER_SCREEN = ['auto', '4', '9', '16', '25'] as const
type PeoplePerScreen = (typeof PEOPLE_PER_SCREEN)[number]

const LAYOUT_STORAGE_KEY = 'practices.call.layout'
const PEOPLE_STORAGE_KEY = 'practices.call.peoplePerScreen'

// A choice kept in localStorage. The server and the first render use the default, so the page hydrates without a mismatch.
const storageListeners = new Set<() => void>()

const useStoredChoice = <T extends string>(key: string, options: readonly T[], fallback: T): [T, (value: T) => void] => {
  const stored = useSyncExternalStore(
    (listener) => {
      storageListeners.add(listener)
      window.addEventListener('storage', listener)
      return () => {
        storageListeners.delete(listener)
        window.removeEventListener('storage', listener)
      }
    },
    () => {
      try {
        return window.localStorage.getItem(key)
      } catch {
        return null
      }
    },
    () => null
  )
  const value = options.includes(stored as T) ? (stored as T) : fallback

  const choose = (next: T) => {
    try {
      window.localStorage.setItem(key, next)
    } catch {
      // Private windows can refuse storage. The choice then lasts until the page closes.
    }
    storageListeners.forEach((listener) => listener())
  }
  return [value, choose]
}

const isSameTrack = (first?: TrackReferenceOrPlaceholder, second?: TrackReferenceOrPlaceholder) =>
  Boolean(first && second && first.participant.identity === second.participant.identity && first.source === second.source)

const trackKey = (track: TrackReferenceOrPlaceholder) => `${track.participant.identity}:${track.source}`

// The camera of whoever spoke last. Someone else is preferred to the viewer, who knows what they look like.
const lastSpeakerCamera = (tracks: TrackReferenceOrPlaceholder[]) => {
  const cameras = tracks.filter((track) => track.source === Track.Source.Camera)
  const others = cameras.filter((track) => !track.participant.isLocal)
  const candidates = others.length > 0 ? others : cameras
  return [...candidates].sort(
    (first, second) => (second.participant.lastSpokeAt?.getTime() ?? 0) - (first.participant.lastSpokeAt?.getTime() ?? 0)
  )[0]
}

// The grid with a fixed number of people per page, each page as square as the count allows.
function PagedGrid({ tracks, peoplePerScreen }: { tracks: TrackReferenceOrPlaceholder[]; peoplePerScreen: number }) {
  const [requestedPage, setRequestedPage] = useState(0)
  const pageCount = Math.max(Math.ceil(tracks.length / peoplePerScreen), 1)
  const page = Math.min(requestedPage, pageCount - 1)
  const shown = tracks.slice(page * peoplePerScreen, (page + 1) * peoplePerScreen)
  const columns = Math.max(Math.ceil(Math.sqrt(shown.length)), 1)
  const rows = Math.max(Math.ceil(shown.length / columns), 1)

  return (
    <div className="practice-grid" data-people-per-screen={peoplePerScreen}>
      <div
        className="practice-grid-tiles"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      >
        {shown.map((track) => (
          <ParticipantTile key={trackKey(track)} trackRef={track} />
        ))}
      </div>
      {pageCount > 1 && (
        <div className="practice-grid-pages">
          <button type="button" className="lk-button" onClick={() => setRequestedPage(page - 1)} disabled={page === 0} aria-label="Previous people">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span aria-live="polite">
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            className="lk-button"
            onClick={() => setRequestedPage(page + 1)}
            disabled={page === pageCount - 1}
            aria-label="Next people"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}

// The call of a practice: cameras, screen shares, the controls and the chat, with a bar to choose how people are laid out.
// A person pinned with the button on their tile fills the screen in any layout, until they are unpinned.
type PracticeCallProps = {
  // The room the person is in. Group 0 is the main room.
  currentGroup: number
  // The panel where the host arranges the groups. Only the host has it. It stays open when the host moves between rooms.
  groupsPanel: ReactNode
  showGroups: boolean
  onToggleGroups: () => void
  // The button that ends the call for everyone. Only the host has it.
  endCall: ReactNode
}

export default function PracticeCall({ currentGroup, groupsPanel, showGroups, onToggleGroups, endCall }: PracticeCallProps) {
  const [layout, setLayout] = useStoredChoice(LAYOUT_STORAGE_KEY, LAYOUTS, 'grid')
  const [peoplePerScreen, setPeoplePerScreen] = useStoredChoice(PEOPLE_STORAGE_KEY, PEOPLE_PER_SCREEN, 'auto')
  const [widgetState, setWidgetState] = useState<WidgetState>({ showChat: false, unreadMessages: 0, showSettings: false })
  const lastAutoPinnedShare = useRef<TrackReferenceOrPlaceholder | null>(null)

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false }
  )

  const layoutContext = useCreateLayoutContext()
  const pinnedTrack = usePinnedTracks(layoutContext)?.[0]
  const focusTrack = pinnedTrack ?? (layout === 'speaker' ? lastSpeakerCamera(tracks) : undefined)
  const stripTracks = tracks.filter((track) => !isSameTrack(track, focusTrack))

  const screenShares = tracks.filter(isTrackReference).filter((track) => track.publication.source === Track.Source.ScreenShare)
  const screenShareKey = screenShares.map((track) => `${track.publication.trackSid}_${track.publication.isSubscribed}`).join()

  // A screen share fills the screen when it starts, and the pin goes away when it stops, as in the LiveKit conference.
  useEffect(() => {
    if (screenShares.some((track) => track.publication.isSubscribed) && lastAutoPinnedShare.current === null) {
      layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShares[0] })
      lastAutoPinnedShare.current = screenShares[0]
    } else if (
      lastAutoPinnedShare.current &&
      !screenShares.some((track) => track.publication.trackSid === lastAutoPinnedShare.current?.publication?.trackSid)
    ) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' })
      lastAutoPinnedShare.current = null
    }
    // Only a change in the shares matters here. The list itself is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenShareKey])

  return (
    <div className="lk-video-conference">
      <LayoutContextProvider value={layoutContext} onWidgetChange={setWidgetState}>
        <div className="lk-video-conference-inner">
          <div className="practice-call-bar">
            <div role="group" aria-label="Layout" className="practice-call-choice">
              {LAYOUTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="lk-button"
                  aria-pressed={layout === option}
                  onClick={() => setLayout(option)}
                  disabled={Boolean(pinnedTrack)}
                >
                  {LAYOUT_LABELS[option]}
                </button>
              ))}
            </div>

            {layout === 'grid' && !pinnedTrack && (
              <label className="practice-call-select">
                People per screen
                <select value={peoplePerScreen} onChange={(event) => setPeoplePerScreen(event.target.value as PeoplePerScreen)}>
                  {PEOPLE_PER_SCREEN.map((option) => (
                    <option key={option} value={option}>
                      {option === 'auto' ? 'As many as fit' : option}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {pinnedTrack && (
              <button type="button" className="lk-button" onClick={() => layoutContext.pin.dispatch?.({ msg: 'clear_pin' })}>
                Unpin {pinnedTrack.participant.name || 'the person'}
              </button>
            )}

            <div className="practice-call-bar-end">
              {currentGroup > 0 && (
                <p role="status" className="practice-call-group">
                  You are in group {currentGroup}
                </p>
              )}
              {groupsPanel && (
                <button type="button" className="lk-button" aria-pressed={showGroups} onClick={onToggleGroups}>
                  Groups
                </button>
              )}
              {endCall}
            </div>
          </div>

          {focusTrack ? (
            <div className="lk-focus-layout-wrapper" data-call-layout={pinnedTrack ? 'pinned' : 'speaker'}>
              <FocusLayoutContainer>
                <CarouselLayout tracks={stripTracks}>
                  <ParticipantTile />
                </CarouselLayout>
                <FocusLayout trackRef={focusTrack} />
              </FocusLayoutContainer>
            </div>
          ) : (
            <div className="lk-grid-layout-wrapper" data-call-layout="grid">
              {peoplePerScreen === 'auto' ? (
                <GridLayout tracks={tracks}>
                  <ParticipantTile />
                </GridLayout>
              ) : (
                <PagedGrid tracks={tracks} peoplePerScreen={Number(peoplePerScreen)} />
              )}
            </div>
          )}

          <ControlBar controls={{ chat: true, settings: false }} />
        </div>
        <Chat style={{ display: widgetState.showChat ? 'grid' : 'none' }} />
        {showGroups && groupsPanel}
      </LayoutContextProvider>
      <RoomAudioRenderer />
      <ConnectionStateToast />
    </div>
  )
}
