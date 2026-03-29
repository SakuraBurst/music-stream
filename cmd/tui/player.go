package main

import (
	"fmt"
	"math"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/sakuraburst/sonus/pkg/client"
)

// queueTrack holds the information needed to play a track.
type queueTrack struct {
	id         string
	title      string
	artistName string
	albumName  string
	duration   int // seconds
}

// playerModel manages the play queue, mpv subprocess, and player bar rendering.
type playerModel struct {
	client *client.Client
	mpv    *mpvInstance

	// Queue
	queue        []queueTrack
	currentIndex int // index into queue, -1 if nothing playing

	// Status from mpv
	position float64 // seconds
	duration float64 // seconds
	paused   bool
	volume   float64 // 0-100
	idle     bool

	// Display
	width   int
	playing bool // true if we have started playback
	err     string
}

// --- Messages ---

// playTrackMsg requests playing a single track.
type playTrackMsg struct {
	track queueTrack
}

// playAlbumMsg requests queuing and playing an entire album.
type playAlbumMsg struct {
	tracks []queueTrack
}

// mpvStatusMsg carries a periodic status update from mpv.
type mpvStatusMsg struct {
	status mpvStatus
	err    error
}

// mpvStartedMsg indicates mpv has started playing.
type mpvStartedMsg struct {
	err error
}

// tickMsg triggers periodic status polling.
type tickMsg time.Time

func newPlayerModel(c *client.Client) playerModel {
	return playerModel{
		client:       c,
		mpv:          newMpvInstance(),
		currentIndex: -1,
		volume:       100,
	}
}

// startStatusTicker returns a tea.Cmd that sends a tickMsg after a delay.
func startStatusTicker() tea.Cmd {
	return tea.Tick(500*time.Millisecond, func(t time.Time) tea.Msg {
		return tickMsg(t)
	})
}

// pollStatus queries mpv for its current status.
func (m playerModel) pollStatus() tea.Cmd {
	mpv := m.mpv
	return func() tea.Msg {
		status, err := mpv.GetStatus()
		return mpvStatusMsg{status: status, err: err}
	}
}

// playCurrentTrack starts mpv with the current track from the queue.
func (m playerModel) playCurrentTrack() tea.Cmd {
	if m.currentIndex < 0 || m.currentIndex >= len(m.queue) {
		return nil
	}
	track := m.queue[m.currentIndex]
	mpv := m.mpv
	c := m.client
	return func() tea.Msg {
		url := c.StreamURL(track.id)
		err := mpv.Play(url)
		return mpvStartedMsg{err: err}
	}
}

func (m playerModel) update(msg tea.Msg) (playerModel, tea.Cmd) {
	switch msg := msg.(type) {

	case playTrackMsg:
		// Clear queue and play this single track.
		m.queue = []queueTrack{msg.track}
		m.currentIndex = 0
		m.playing = true
		m.paused = false
		m.err = ""
		return m, m.playCurrentTrack()

	case playAlbumMsg:
		if len(msg.tracks) == 0 {
			return m, nil
		}
		// Replace queue with album tracks and start from the first.
		m.queue = msg.tracks
		m.currentIndex = 0
		m.playing = true
		m.paused = false
		m.err = ""
		return m, m.playCurrentTrack()

	case mpvStartedMsg:
		if msg.err != nil {
			m.err = msg.err.Error()
			m.playing = false
			return m, nil
		}
		// Start polling for status updates.
		return m, startStatusTicker()

	case tickMsg:
		if !m.playing {
			return m, nil
		}
		return m, m.pollStatus()

	case mpvStatusMsg:
		if !m.playing {
			return m, nil
		}
		if msg.err != nil {
			// mpv might have exited (track ended). Check if we should advance.
			if !m.mpv.IsRunning() {
				return m.advanceQueue()
			}
			// Otherwise continue polling.
			return m, startStatusTicker()
		}

		m.position = msg.status.Position
		m.duration = msg.status.Duration
		m.paused = msg.status.Paused
		m.volume = msg.status.Volume
		m.idle = msg.status.Idle

		// If mpv is idle (track finished), advance to next track.
		if msg.status.Idle {
			return m.advanceQueue()
		}

		// Continue polling.
		return m, startStatusTicker()
	}

	return m, nil
}

// advanceQueue moves to the next track in the queue. If at the end, stops playing.
func (m playerModel) advanceQueue() (playerModel, tea.Cmd) {
	if m.currentIndex+1 < len(m.queue) {
		m.currentIndex++
		m.position = 0
		m.duration = 0
		m.paused = false
		return m, m.playCurrentTrack()
	}
	// End of queue.
	m.playing = false
	m.mpv.Stop()
	return m, nil
}

// handleKey processes player-specific key bindings. Returns true if the key was consumed.
func (m playerModel) handleKey(keyStr string) (playerModel, tea.Cmd, bool) {
	if !m.playing {
		return m, nil, false
	}

	switch keyStr {
	case "p":
		if err := m.mpv.TogglePause(); err == nil {
			m.paused = !m.paused
		}
		return m, nil, true

	case "n":
		return m.nextTrack()

	case "b":
		return m.prevTrack()

	case "+", "=":
		if err := m.mpv.AdjustVolume(5); err == nil {
			m.volume = math.Min(m.volume+5, 100)
		}
		return m, nil, true

	case "-":
		if err := m.mpv.AdjustVolume(-5); err == nil {
			m.volume = math.Max(m.volume-5, 0)
		}
		return m, nil, true

	case "right":
		_ = m.mpv.Seek(5)
		return m, nil, true

	case "left":
		_ = m.mpv.Seek(-5)
		return m, nil, true

	case "shift+right":
		_ = m.mpv.Seek(30)
		return m, nil, true

	case "shift+left":
		_ = m.mpv.Seek(-30)
		return m, nil, true
	}

	return m, nil, false
}

func (m playerModel) nextTrack() (playerModel, tea.Cmd, bool) {
	if m.currentIndex+1 < len(m.queue) {
		m.currentIndex++
		m.position = 0
		m.duration = 0
		m.paused = false
		return m, m.playCurrentTrack(), true
	}
	return m, nil, true
}

func (m playerModel) prevTrack() (playerModel, tea.Cmd, bool) {
	// If more than 3 seconds into the track, restart it; otherwise go to previous.
	if m.position > 3 && m.currentIndex >= 0 {
		_ = m.mpv.Seek(-m.position)
		return m, nil, true
	}
	if m.currentIndex > 0 {
		m.currentIndex--
		m.position = 0
		m.duration = 0
		m.paused = false
		return m, m.playCurrentTrack(), true
	}
	// Already at the first track, just restart.
	if m.currentIndex >= 0 {
		_ = m.mpv.Seek(-m.position)
	}
	return m, nil, true
}

// stop shuts down mpv cleanly.
func (m *playerModel) stop() {
	m.mpv.Stop()
	m.playing = false
}

// currentTrack returns the currently playing track, or nil if nothing is playing.
func (m playerModel) currentTrack() *queueTrack {
	if m.currentIndex < 0 || m.currentIndex >= len(m.queue) {
		return nil
	}
	return &m.queue[m.currentIndex]
}

// --- Player bar styles ---

var (
	playerBarBorder = lipgloss.NewStyle().
		BorderTop(true).
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(lipgloss.Color("238"))

	playerTrackStyle = lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("205"))

	playerArtistStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("245"))

	playerTimeStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("241"))

	playerPausedStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("214")).
		Bold(true)

	playerProgressFilled = lipgloss.NewStyle().
		Foreground(lipgloss.Color("205"))

	playerProgressEmpty = lipgloss.NewStyle().
		Foreground(lipgloss.Color("238"))

	playerVolumeStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("241"))

	playerErrStyle = lipgloss.NewStyle().
		Foreground(lipgloss.Color("196"))
)

// playerBarHeight returns the number of lines the player bar occupies.
func (m playerModel) playerBarHeight() int {
	if !m.playing && m.err == "" {
		return 0
	}
	return 3 // border + track info + progress bar
}

// viewPlayerBar renders the player bar at the bottom of the screen.
func (m playerModel) viewPlayerBar(width int) string {
	if !m.playing && m.err == "" {
		return ""
	}

	if m.err != "" {
		return playerBarBorder.Width(width).Render(
			playerErrStyle.Render("Player error: " + m.err),
		)
	}

	track := m.currentTrack()
	if track == nil {
		return ""
	}

	// Line 1: Track info
	trackInfo := playerTrackStyle.Render(track.title)
	if track.artistName != "" {
		trackInfo += playerArtistStyle.Render(" - " + track.artistName)
	}

	stateIcon := ">"
	if m.paused {
		stateIcon = playerPausedStyle.Render("||")
	}

	timeStr := fmt.Sprintf("[%s / %s]",
		formatDurationFloat(m.position),
		formatDurationFloat(m.duration),
	)

	queueInfo := ""
	if len(m.queue) > 1 {
		queueInfo = fmt.Sprintf(" (%d/%d)", m.currentIndex+1, len(m.queue))
	}

	line1 := fmt.Sprintf(" %s %s%s  %s", stateIcon, trackInfo, queueInfo, playerTimeStyle.Render(timeStr))

	// Line 2: Progress bar + volume
	progressWidth := width - 20 // Leave room for volume display
	if progressWidth < 10 {
		progressWidth = 10
	}

	var progress float64
	if m.duration > 0 {
		progress = m.position / m.duration
	}
	if progress > 1 {
		progress = 1
	}
	if progress < 0 {
		progress = 0
	}

	filled := int(float64(progressWidth) * progress)
	empty := progressWidth - filled

	progressBar := playerProgressFilled.Render(strings.Repeat("█", filled)) +
		playerProgressEmpty.Render(strings.Repeat("░", empty))

	volStr := playerVolumeStyle.Render(fmt.Sprintf(" Vol: %d%%", int(m.volume)))
	line2 := " " + progressBar + volStr

	content := line1 + "\n" + line2
	return playerBarBorder.Width(width).Render(content)
}

// playerStatusHints returns keyboard hints for the player.
func (m playerModel) playerStatusHints() string {
	if !m.playing {
		return ""
	}
	hints := "[p] pause  [n] next  [b] prev  [+/-] vol  [</>] seek"
	return hints
}

// formatDurationFloat converts seconds (float64) to m:ss or h:mm:ss.
func formatDurationFloat(seconds float64) string {
	if seconds <= 0 {
		return "0:00"
	}
	total := int(seconds)
	h := total / 3600
	m := (total % 3600) / 60
	s := total % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}
