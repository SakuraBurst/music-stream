package main

import (
	"errors"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/sakuraburst/sonus/pkg/client"
)

// Tab represents a top-level navigation tab.
type Tab int

const (
	TabLibrary Tab = iota
	TabSearch
	TabPlaylists
	TabQueue
)

var tabNames = []string{"Library", "Search", "Playlists", "Queue"}

// appModel is the top-level bubbletea model that manages screens and navigation.
type appModel struct {
	client    *client.Client
	tokenPath string

	width  int
	height int

	// Current screen
	showLogin bool
	login     loginModel

	// Tab navigation (shown after login)
	activeTab Tab

	// Sub-models
	library libraryModel
	search  searchModel
	player  playerModel

	// mpv availability
	mpvAvailable bool
	mpvWarning   string
}

// loginDoneMsg is sent when the login screen completes successfully.
type loginDoneMsg struct {
	client *client.Client
}

// authExpiredMsg signals that the session is no longer valid and the user
// must re-authenticate.
type authExpiredMsg struct{}

// isAuthError returns true if the error is a 401 Unauthorized API error.
func isAuthError(err error) bool {
	var apiErr *client.APIError
	if errors.As(err, &apiErr) && apiErr.StatusCode == 401 {
		return true
	}
	return false
}

func newAppModel(apiClient *client.Client, tokenPath string, needLogin bool) appModel {
	mpvOK := checkMpvAvailable()
	var mpvWarn string
	if !mpvOK {
		mpvWarn = "mpv not found in PATH — playback disabled. Install mpv to enable audio playback."
	}

	m := appModel{
		client:       apiClient,
		tokenPath:    tokenPath,
		showLogin:    needLogin,
		login:        newLoginModel(),
		mpvAvailable: mpvOK,
		mpvWarning:   mpvWarn,
	}
	if apiClient != nil {
		m.library = newLibraryModel(apiClient)
		m.search = newSearchModel(apiClient)
		m.player = newPlayerModel(apiClient)
	}
	return m
}

func (m appModel) Init() tea.Cmd {
	if m.showLogin {
		return m.login.Init()
	}
	// Already logged in — load the library.
	return m.library.Init()
}

func (m appModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.player.width = msg.Width
		if m.showLogin {
			m.login.width = msg.Width
			m.login.height = msg.Height
		}
		// Reduce available height for content when player bar is visible.
		adjustedMsg := msg
		playerH := m.player.playerBarHeight()
		if playerH > 0 {
			adjustedMsg.Height = msg.Height - playerH
		}
		// Forward to sub-models so they can resize their lists.
		if !m.showLogin {
			var libCmd, searchCmd tea.Cmd
			m.library, libCmd = m.library.update(adjustedMsg)
			m.search, searchCmd = m.search.update(adjustedMsg)
			return m, tea.Batch(libCmd, searchCmd)
		}
		return m, nil

	case tea.KeyMsg:
		// Global quit: Ctrl+C always quits.
		if key.Matches(msg, key.NewBinding(key.WithKeys("ctrl+c"))) {
			m.player.stop()
			return m, tea.Quit
		}

		// If on the main screen (not login), handle tab switching and quit.
		if !m.showLogin {
			// Don't intercept keys if a list filter is active or search input is focused.
			if m.isSubModelCapturingKeys() {
				return m.delegateToActiveTab(msg)
			}

			// Player keys are handled globally (not captured by sub-models).
			var playerCmd tea.Cmd
			var consumed bool
			m.player, playerCmd, consumed = m.player.handleKey(msg.String())
			if consumed {
				return m, playerCmd
			}

			switch {
			case key.Matches(msg, key.NewBinding(key.WithKeys("q"))):
				m.player.stop()
				return m, tea.Quit
			case key.Matches(msg, key.NewBinding(key.WithKeys("1"))):
				m.activeTab = TabLibrary
				return m, nil
			case key.Matches(msg, key.NewBinding(key.WithKeys("2"))):
				prevTab := m.activeTab
				m.activeTab = TabSearch
				if prevTab != TabSearch {
					var cmd tea.Cmd
					m.search, cmd = m.search.onActivate()
					return m, cmd
				}
				return m, nil
			case key.Matches(msg, key.NewBinding(key.WithKeys("3"))):
				m.activeTab = TabPlaylists
				return m, nil
			case key.Matches(msg, key.NewBinding(key.WithKeys("4"))):
				m.activeTab = TabQueue
				return m, nil
			case key.Matches(msg, key.NewBinding(key.WithKeys("tab"))):
				prevTab := m.activeTab
				m.activeTab = Tab((int(m.activeTab) + 1) % len(tabNames))
				if m.activeTab == TabSearch && prevTab != TabSearch {
					var cmd tea.Cmd
					m.search, cmd = m.search.onActivate()
					return m, cmd
				}
				return m, nil
			case key.Matches(msg, key.NewBinding(key.WithKeys("shift+tab"))):
				prevTab := m.activeTab
				m.activeTab = Tab((int(m.activeTab) - 1 + len(tabNames)) % len(tabNames))
				if m.activeTab == TabSearch && prevTab != TabSearch {
					var cmd tea.Cmd
					m.search, cmd = m.search.onActivate()
					return m, cmd
				}
				return m, nil
			}

			// Delegate key events to the active tab's sub-model.
			return m.delegateToActiveTab(msg)
		}

	case authExpiredMsg:
		// Session expired — clear saved tokens and show login screen.
		if m.tokenPath != "" {
			_ = os.Remove(m.tokenPath)
		}
		m.showLogin = true
		m.client = nil
		m.login = newLoginModel()
		m.login.width = m.width
		m.login.height = m.height
		m.login.err = "Session expired. Please log in again."
		m.player.stop()
		return m, m.login.Init()

	case libraryErrMsg:
		if isAuthError(msg.err) {
			return m, func() tea.Msg { return authExpiredMsg{} }
		}

	case searchErrMsg:
		if isAuthError(msg.err) {
			return m, func() tea.Msg { return authExpiredMsg{} }
		}

	case loginDoneMsg:
		m.showLogin = false
		m.client = msg.client
		m.library = newLibraryModel(msg.client)
		m.search = newSearchModel(msg.client)
		m.player = newPlayerModel(msg.client)
		m.player.width = m.width
		// Apply current window size to the new sub-models.
		if m.width > 0 && m.height > 0 {
			sizeMsg := tea.WindowSizeMsg{Width: m.width, Height: m.height}
			adjustedMsg := sizeMsg
			playerH := m.player.playerBarHeight()
			if playerH > 0 {
				adjustedMsg.Height = sizeMsg.Height - playerH
			}
			m.library, _ = m.library.update(adjustedMsg)
			m.search, _ = m.search.update(adjustedMsg)
		}
		// Load the library on login completion.
		return m, m.library.Init()
	}

	// Delegate to login screen if active.
	if m.showLogin {
		var cmd tea.Cmd
		m.login, cmd = m.login.update(msg)
		return m, cmd
	}

	// Intercept playback messages from library/search and route to player.
	switch msg := msg.(type) {
	case albumTracksLoadedMsg:
		// Forward to library for display.
		var libCmd tea.Cmd
		m.library, libCmd = m.library.update(msg)
		// Start playback if mpv is available.
		if m.mpvAvailable && len(msg.playTracks) > 0 {
			var playerCmd tea.Cmd
			m.player, playerCmd = m.player.update(playAlbumMsg{tracks: msg.playTracks})
			return m, tea.Batch(libCmd, playerCmd)
		}
		return m, libCmd

	case playTrackMsg, playAlbumMsg:
		// Route directly to the player.
		if m.mpvAvailable {
			var playerCmd tea.Cmd
			m.player, playerCmd = m.player.update(msg)
			return m, playerCmd
		}
		return m, nil
	}

	// Delegate non-key messages to all sub-models so they can handle async results.
	return m.delegateToAll(msg)
}

// isSubModelCapturingKeys returns true if the active sub-model is in a state
// where it needs to capture all key presses (e.g., filtering or text input).
func (m appModel) isSubModelCapturingKeys() bool {
	switch m.activeTab {
	case TabLibrary:
		activeList := m.library.activeList()
		return activeList.FilterState() == list.Filtering
	case TabSearch:
		return m.search.focus == focusInput
	}
	return false
}

// delegateToActiveTab sends a message to the active tab's sub-model.
func (m appModel) delegateToActiveTab(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch m.activeTab {
	case TabLibrary:
		var cmd tea.Cmd
		m.library, cmd = m.library.update(msg)
		return m, cmd
	case TabSearch:
		var cmd tea.Cmd
		m.search, cmd = m.search.update(msg)
		return m, cmd
	}
	return m, nil
}

// delegateToAll sends a message (typically async result messages) to all sub-models.
func (m appModel) delegateToAll(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	var libCmd tea.Cmd
	m.library, libCmd = m.library.update(msg)
	if libCmd != nil {
		cmds = append(cmds, libCmd)
	}

	var searchCmd tea.Cmd
	m.search, searchCmd = m.search.update(msg)
	if searchCmd != nil {
		cmds = append(cmds, searchCmd)
	}

	var playerCmd tea.Cmd
	m.player, playerCmd = m.player.update(msg)
	if playerCmd != nil {
		cmds = append(cmds, playerCmd)
	}

	if len(cmds) > 0 {
		return m, tea.Batch(cmds...)
	}
	return m, nil
}

func (m appModel) View() string {
	if m.showLogin {
		return m.login.view()
	}
	return m.mainView()
}

// Styles
var (
	titleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("205")).
			Padding(0, 1)

	activeTabStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("205")).
			Background(lipgloss.Color("236")).
			Padding(0, 2)

	inactiveTabStyle = lipgloss.NewStyle().
				Foreground(lipgloss.Color("245")).
				Padding(0, 2)

	tabBarStyle = lipgloss.NewStyle().
			BorderBottom(true).
			BorderStyle(lipgloss.NormalBorder()).
			BorderForeground(lipgloss.Color("238"))

	statusBarStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			Padding(0, 1)
)

func (m appModel) mainView() string {
	var b strings.Builder

	// Title
	title := titleStyle.Render("Sonus")
	b.WriteString(title)
	b.WriteString("\n")

	// mpv warning (shown once if mpv is not available)
	if m.mpvWarning != "" {
		warn := lipgloss.NewStyle().Foreground(lipgloss.Color("214")).Render(m.mpvWarning)
		b.WriteString(warn)
		b.WriteString("\n")
	}

	// Tab bar
	var tabs []string
	for i, name := range tabNames {
		if Tab(i) == m.activeTab {
			tabs = append(tabs, activeTabStyle.Render(name))
		} else {
			tabs = append(tabs, inactiveTabStyle.Render(name))
		}
	}
	tabBar := tabBarStyle.Render(lipgloss.JoinHorizontal(lipgloss.Top, tabs...))
	b.WriteString(tabBar)
	b.WriteString("\n")

	// Content area
	content := m.tabContent()
	b.WriteString(content)
	b.WriteString("\n")

	// Player bar
	playerBar := m.player.viewPlayerBar(m.width)
	if playerBar != "" {
		b.WriteString(playerBar)
		b.WriteString("\n")
	}

	// Status bar with key hints
	hints := m.statusHints()
	statusBar := statusBarStyle.Render(hints)
	b.WriteString(statusBar)

	return b.String()
}

func (m appModel) tabContent() string {
	switch m.activeTab {
	case TabLibrary:
		return m.library.view()
	case TabSearch:
		return m.search.view()
	case TabPlaylists:
		return "Playlists\n\nManage your playlists here.\n(Coming soon)"
	case TabQueue:
		return "Queue\n\nView your play queue here.\n(Coming soon)"
	default:
		return ""
	}
}

func (m appModel) statusHints() string {
	var base string
	switch m.activeTab {
	case TabLibrary:
		base = m.library.statusHints()
	case TabSearch:
		base = m.search.statusHints()
	default:
		base = "[1-4] switch tabs  [tab] next tab  [q] quit  [ctrl+c] force quit"
	}

	playerHints := m.player.playerStatusHints()
	if playerHints != "" {
		return base + "  " + playerHints
	}
	return base
}
