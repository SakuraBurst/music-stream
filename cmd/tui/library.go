package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/sakuraburst/sonus/pkg/client"
)

// libraryLevel represents the current navigation depth in the library.
type libraryLevel int

const (
	levelArtists libraryLevel = iota
	levelAlbums
	levelTracks
)

const pageSize = 50

// listItem implements list.Item for bubbles list component.
type listItem struct {
	id          string
	title       string
	description string
}

func (i listItem) Title() string       { return i.title }
func (i listItem) Description() string { return i.description }
func (i listItem) FilterValue() string { return i.title }

// --- Messages ---

type artistsLoadedMsg struct {
	items []list.Item
	total int
}

type albumsLoadedMsg struct {
	items      []list.Item
	total      int
	artistName string
}

type tracksLoadedMsg struct {
	items     []list.Item
	total     int
	albumName string
}

type libraryErrMsg struct {
	err error
}

type moreArtistsLoadedMsg struct {
	items []list.Item
	total int
}

type moreAlbumsLoadedMsg struct {
	items []list.Item
	total int
}

type moreTracksLoadedMsg struct {
	items []list.Item
	total int
}

// --- Library Model ---

type libraryModel struct {
	client *client.Client
	level  libraryLevel
	width  int
	height int

	// List models for each level
	artistList list.Model
	albumList  list.Model
	trackList  list.Model

	// Navigation context
	selectedArtistID   string
	selectedArtistName string
	selectedAlbumID    string
	selectedAlbumName  string

	// Pagination state
	artistsLoaded int
	artistsTotal  int
	albumsLoaded  int
	albumsTotal   int
	tracksLoaded  int
	tracksTotal   int

	// Loading / error state
	loading    bool
	loadingMsg string
	err        string
}

func newLibraryModel(c *client.Client) libraryModel {
	// Create delegate for list styling.
	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = delegate.Styles.SelectedTitle.
		Foreground(lipgloss.Color("205")).
		BorderLeftForeground(lipgloss.Color("205"))
	delegate.Styles.SelectedDesc = delegate.Styles.SelectedDesc.
		Foreground(lipgloss.Color("241")).
		BorderLeftForeground(lipgloss.Color("205"))

	artistList := list.New(nil, delegate, 0, 0)
	artistList.Title = "Artists"
	artistList.SetShowStatusBar(true)
	artistList.SetFilteringEnabled(true)
	artistList.SetShowHelp(false)
	artistList.DisableQuitKeybindings()

	albumList := list.New(nil, delegate, 0, 0)
	albumList.Title = "Albums"
	albumList.SetShowStatusBar(true)
	albumList.SetFilteringEnabled(true)
	albumList.SetShowHelp(false)
	albumList.DisableQuitKeybindings()

	trackList := list.New(nil, delegate, 0, 0)
	trackList.Title = "Tracks"
	trackList.SetShowStatusBar(true)
	trackList.SetFilteringEnabled(true)
	trackList.SetShowHelp(false)
	trackList.DisableQuitKeybindings()

	return libraryModel{
		client:     c,
		level:      levelArtists,
		artistList: artistList,
		albumList:  albumList,
		trackList:  trackList,
	}
}

func (m libraryModel) Init() tea.Cmd {
	return m.loadArtists(0)
}

func (m libraryModel) activeList() *list.Model {
	switch m.level {
	case levelAlbums:
		return &m.albumList
	case levelTracks:
		return &m.trackList
	default:
		return &m.artistList
	}
}

func (m libraryModel) update(msg tea.Msg) (libraryModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		listHeight := msg.Height - 6 // Reserve space for tab bar, title, status bar.
		if listHeight < 5 {
			listHeight = 5
		}
		m.artistList.SetSize(msg.Width-4, listHeight)
		m.albumList.SetSize(msg.Width-4, listHeight)
		m.trackList.SetSize(msg.Width-4, listHeight)
		return m, nil

	case artistsLoadedMsg:
		m.loading = false
		m.artistList.SetItems(msg.items)
		m.artistsLoaded = len(msg.items)
		m.artistsTotal = msg.total
		m.artistList.Title = fmt.Sprintf("Artists (%d)", msg.total)
		return m, nil

	case albumsLoadedMsg:
		m.loading = false
		m.level = levelAlbums
		m.selectedArtistName = msg.artistName
		m.albumList.SetItems(msg.items)
		m.albumsLoaded = len(msg.items)
		m.albumsTotal = msg.total
		m.albumList.Title = fmt.Sprintf("Albums by %s (%d)", msg.artistName, msg.total)
		m.albumList.ResetSelected()
		return m, nil

	case albumTracksLoadedMsg:
		m.loading = false
		m.level = levelTracks
		m.selectedAlbumName = msg.albumName
		m.trackList.SetItems(msg.items)
		m.tracksLoaded = len(msg.items)
		m.tracksTotal = msg.total
		m.trackList.Title = fmt.Sprintf("%s — %s (%d tracks)", m.selectedArtistName, msg.albumName, msg.total)
		m.trackList.ResetSelected()
		// The app model will also see this message and route playTracks to the player.
		return m, nil

	case tracksLoadedMsg:
		m.loading = false
		m.level = levelTracks
		m.selectedAlbumName = msg.albumName
		m.trackList.SetItems(msg.items)
		m.tracksLoaded = len(msg.items)
		m.tracksTotal = msg.total
		m.trackList.Title = fmt.Sprintf("%s — %s (%d tracks)", m.selectedArtistName, msg.albumName, msg.total)
		m.trackList.ResetSelected()
		return m, nil

	case moreArtistsLoadedMsg:
		m.loading = false
		items := m.artistList.Items()
		items = append(items, msg.items...)
		m.artistList.SetItems(items)
		m.artistsLoaded = len(items)
		m.artistsTotal = msg.total
		return m, nil

	case moreAlbumsLoadedMsg:
		m.loading = false
		items := m.albumList.Items()
		items = append(items, msg.items...)
		m.albumList.SetItems(items)
		m.albumsLoaded = len(items)
		m.albumsTotal = msg.total
		return m, nil

	case moreTracksLoadedMsg:
		m.loading = false
		items := m.trackList.Items()
		items = append(items, msg.items...)
		m.trackList.SetItems(items)
		m.tracksLoaded = len(items)
		m.tracksTotal = msg.total
		return m, nil

	case libraryErrMsg:
		m.loading = false
		m.err = msg.err.Error()
		return m, nil

	case tea.KeyMsg:
		// If the list is filtering, let it handle all keys.
		activeList := m.activeList()
		if activeList.FilterState() == list.Filtering {
			var cmd tea.Cmd
			switch m.level {
			case levelArtists:
				m.artistList, cmd = m.artistList.Update(msg)
			case levelAlbums:
				m.albumList, cmd = m.albumList.Update(msg)
			case levelTracks:
				m.trackList, cmd = m.trackList.Update(msg)
			}
			return m, cmd
		}

		switch {
		case key.Matches(msg, key.NewBinding(key.WithKeys("enter"))):
			return m.handleEnter()

		case key.Matches(msg, key.NewBinding(key.WithKeys("esc"))):
			return m.handleEsc()

		case key.Matches(msg, key.NewBinding(key.WithKeys("l"))):
			// Load more items if we haven't loaded everything.
			return m.handleLoadMore()
		}
	}

	// Delegate to the active list for navigation (j/k, arrows, etc.).
	var cmd tea.Cmd
	switch m.level {
	case levelArtists:
		m.artistList, cmd = m.artistList.Update(msg)
		// Auto-load more when near the end of the list.
		if m.shouldLoadMore(m.artistList, m.artistsLoaded, m.artistsTotal) {
			moreCmd := m.loadMoreArtists()
			return m, tea.Batch(cmd, moreCmd)
		}
	case levelAlbums:
		m.albumList, cmd = m.albumList.Update(msg)
		if m.shouldLoadMore(m.albumList, m.albumsLoaded, m.albumsTotal) {
			moreCmd := m.loadMoreAlbums()
			return m, tea.Batch(cmd, moreCmd)
		}
	case levelTracks:
		m.trackList, cmd = m.trackList.Update(msg)
		if m.shouldLoadMore(m.trackList, m.tracksLoaded, m.tracksTotal) {
			moreCmd := m.loadMoreTracks()
			return m, tea.Batch(cmd, moreCmd)
		}
	}

	return m, cmd
}

// shouldLoadMore returns true if the user is near the end of the currently loaded items
// and there are more items to fetch.
func (m libraryModel) shouldLoadMore(l list.Model, loaded, total int) bool {
	if m.loading || loaded >= total {
		return false
	}
	idx := l.Index()
	// Load more when within 5 items of the end.
	return idx >= loaded-5
}

// albumTracksLoadedMsg carries loaded album tracks for both display and playback.
type albumTracksLoadedMsg struct {
	tracksLoadedMsg
	playTracks []queueTrack // tracks ready for the player queue
}

func (m libraryModel) handleEnter() (libraryModel, tea.Cmd) {
	if m.loading {
		return m, nil
	}
	switch m.level {
	case levelArtists:
		selected := m.artistList.SelectedItem()
		if selected == nil {
			return m, nil
		}
		item := selected.(listItem)
		m.selectedArtistID = item.id
		m.loading = true
		m.loadingMsg = "Loading albums..."
		return m, m.loadAlbums(item.id, 0)

	case levelAlbums:
		selected := m.albumList.SelectedItem()
		if selected == nil {
			return m, nil
		}
		item := selected.(listItem)
		m.selectedAlbumID = item.id
		m.loading = true
		m.loadingMsg = "Loading tracks..."
		return m, m.loadTracksAndPlay(item.id)

	case levelTracks:
		selected := m.trackList.SelectedItem()
		if selected == nil {
			return m, nil
		}
		// Build a queue from the selected track onward.
		selectedIdx := m.trackList.Index()
		allItems := m.trackList.Items()
		var tracks []queueTrack
		for i := selectedIdx; i < len(allItems); i++ {
			it, ok := allItems[i].(listItem)
			if !ok {
				continue
			}
			tracks = append(tracks, queueTrack{
				id:         it.id,
				title:      it.title,
				artistName: m.selectedArtistName,
				albumName:  m.selectedAlbumName,
				duration:   0, // duration managed by mpv
			})
		}
		if len(tracks) == 0 {
			return m, nil
		}
		return m, func() tea.Msg {
			return playAlbumMsg{tracks: tracks}
		}
	}
	return m, nil
}

func (m libraryModel) handleEsc() (libraryModel, tea.Cmd) {
	switch m.level {
	case levelAlbums:
		m.level = levelArtists
		m.selectedArtistID = ""
		m.selectedArtistName = ""
		return m, nil
	case levelTracks:
		m.level = levelAlbums
		m.selectedAlbumID = ""
		m.selectedAlbumName = ""
		return m, nil
	}
	return m, nil
}

func (m libraryModel) handleLoadMore() (libraryModel, tea.Cmd) {
	if m.loading {
		return m, nil
	}
	switch m.level {
	case levelArtists:
		if m.artistsLoaded < m.artistsTotal {
			m.loading = true
			m.loadingMsg = "Loading more artists..."
			return m, m.loadMoreArtists()
		}
	case levelAlbums:
		if m.albumsLoaded < m.albumsTotal {
			m.loading = true
			m.loadingMsg = "Loading more albums..."
			return m, m.loadMoreAlbums()
		}
	case levelTracks:
		if m.tracksLoaded < m.tracksTotal {
			m.loading = true
			m.loadingMsg = "Loading more tracks..."
			return m, m.loadMoreTracks()
		}
	}
	return m, nil
}

// --- Data loading commands ---

func (m libraryModel) loadArtists(offset int) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		result, err := c.ListArtists(ctx, &client.ListOptions{
			Limit:  pageSize,
			Offset: offset,
		})
		if err != nil {
			return libraryErrMsg{err: err}
		}

		items := make([]list.Item, len(result.Items))
		for i, a := range result.Items {
			items[i] = listItem{
				id:    a.ID,
				title: a.Name,
			}
		}
		return artistsLoadedMsg{items: items, total: result.Total}
	}
}

func (m libraryModel) loadMoreArtists() tea.Cmd {
	c := m.client
	offset := m.artistsLoaded
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		result, err := c.ListArtists(ctx, &client.ListOptions{
			Limit:  pageSize,
			Offset: offset,
		})
		if err != nil {
			return libraryErrMsg{err: err}
		}

		items := make([]list.Item, len(result.Items))
		for i, a := range result.Items {
			items[i] = listItem{
				id:    a.ID,
				title: a.Name,
			}
		}
		return moreArtistsLoadedMsg{items: items, total: result.Total}
	}
}

func (m libraryModel) loadAlbums(artistID string, offset int) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		// Get artist detail to have the name and albums in one call.
		detail, err := c.GetArtist(ctx, artistID)
		if err != nil {
			return libraryErrMsg{err: err}
		}

		items := make([]list.Item, len(detail.Albums))
		for i, a := range detail.Albums {
			yearStr := ""
			if a.Year > 0 {
				yearStr = fmt.Sprintf(" (%d)", a.Year)
			}
			items[i] = listItem{
				id:          a.ID,
				title:       a.Name + yearStr,
				description: fmt.Sprintf("%d tracks, %s", a.TrackCount, formatDuration(a.DurationSeconds)),
			}
		}
		return albumsLoadedMsg{
			items:      items,
			total:      len(detail.Albums),
			artistName: detail.Name,
		}
	}
}

func (m libraryModel) loadMoreAlbums() tea.Cmd {
	c := m.client
	artistID := m.selectedArtistID
	offset := m.albumsLoaded
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		result, err := c.ListAlbums(ctx, &client.ListOptions{
			Limit:    pageSize,
			Offset:   offset,
			ArtistID: artistID,
		})
		if err != nil {
			return libraryErrMsg{err: err}
		}

		items := make([]list.Item, len(result.Items))
		for i, a := range result.Items {
			yearStr := ""
			if a.Year > 0 {
				yearStr = fmt.Sprintf(" (%d)", a.Year)
			}
			items[i] = listItem{
				id:          a.ID,
				title:       a.Name + yearStr,
				description: fmt.Sprintf("%d tracks, %s", a.TrackCount, formatDuration(a.DurationSeconds)),
			}
		}
		return moreAlbumsLoadedMsg{items: items, total: result.Total}
	}
}

func (m libraryModel) loadTracks(albumID string, offset int) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		detail, err := c.GetAlbum(ctx, albumID)
		if err != nil {
			return libraryErrMsg{err: err}
		}

		items := make([]list.Item, len(detail.Tracks))
		for i, t := range detail.Tracks {
			trackNum := ""
			if t.TrackNumber > 0 {
				trackNum = fmt.Sprintf("%d. ", t.TrackNumber)
			}
			items[i] = listItem{
				id:          t.ID,
				title:       trackNum + t.Title,
				description: formatDuration(t.DurationSeconds),
			}
		}
		return tracksLoadedMsg{
			items:     items,
			total:     len(detail.Tracks),
			albumName: detail.Name,
		}
	}
}

// loadTracksAndPlay loads album tracks for display and also prepares them for playback.
func (m libraryModel) loadTracksAndPlay(albumID string) tea.Cmd {
	c := m.client
	artistName := m.selectedArtistName
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		detail, err := c.GetAlbum(ctx, albumID)
		if err != nil {
			return libraryErrMsg{err: err}
		}

		items := make([]list.Item, len(detail.Tracks))
		playTracks := make([]queueTrack, len(detail.Tracks))
		for i, t := range detail.Tracks {
			trackNum := ""
			if t.TrackNumber > 0 {
				trackNum = fmt.Sprintf("%d. ", t.TrackNumber)
			}
			items[i] = listItem{
				id:          t.ID,
				title:       trackNum + t.Title,
				description: formatDuration(t.DurationSeconds),
			}
			playTracks[i] = queueTrack{
				id:         t.ID,
				title:      t.Title,
				artistName: artistName,
				albumName:  detail.Name,
				duration:   t.DurationSeconds,
			}
		}
		return albumTracksLoadedMsg{
			tracksLoadedMsg: tracksLoadedMsg{
				items:     items,
				total:     len(detail.Tracks),
				albumName: detail.Name,
			},
			playTracks: playTracks,
		}
	}
}

func (m libraryModel) loadMoreTracks() tea.Cmd {
	c := m.client
	albumID := m.selectedAlbumID
	offset := m.tracksLoaded
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		result, err := c.ListTracks(ctx, &client.ListOptions{
			Limit:   pageSize,
			Offset:  offset,
			AlbumID: albumID,
		})
		if err != nil {
			return libraryErrMsg{err: err}
		}

		items := make([]list.Item, len(result.Items))
		for i, t := range result.Items {
			trackNum := ""
			if t.TrackNumber > 0 {
				trackNum = fmt.Sprintf("%d. ", t.TrackNumber)
			}
			items[i] = listItem{
				id:          t.ID,
				title:       trackNum + t.Title,
				description: formatDuration(t.DurationSeconds),
			}
		}
		return moreTracksLoadedMsg{items: items, total: result.Total}
	}
}

func (m libraryModel) view() string {
	if m.err != "" {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render("Error: " + m.err)
	}

	if m.loading && m.artistList.Items() == nil {
		return lipgloss.NewStyle().Foreground(lipgloss.Color("205")).Render(m.loadingMsg)
	}

	var b strings.Builder

	switch m.level {
	case levelArtists:
		b.WriteString(m.artistList.View())
	case levelAlbums:
		b.WriteString(m.albumList.View())
	case levelTracks:
		b.WriteString(m.trackList.View())
	}

	return b.String()
}

func (m libraryModel) statusHints() string {
	switch m.level {
	case levelArtists:
		return "[enter] albums  [/] filter  [j/k] navigate  [1-4] tabs  [q] quit"
	case levelAlbums:
		return "[enter] play album  [esc] back  [/] filter  [j/k] navigate  [1-4] tabs  [q] quit"
	case levelTracks:
		return "[enter] play  [esc] back  [/] filter  [j/k] navigate  [1-4] tabs  [q] quit"
	}
	return ""
}

// formatDuration converts seconds to m:ss or h:mm:ss format.
func formatDuration(seconds int) string {
	if seconds <= 0 {
		return "0:00"
	}
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}
