package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/sakuraburst/sonus/pkg/client"
)

// searchFocus indicates whether the user is typing or browsing results.
type searchFocus int

const (
	focusInput searchFocus = iota
	focusResults
)

// searchResultItem extends listItem with a type marker so we can display grouped headers.
type searchResultItem struct {
	listItem
	resultType string // "artist", "album", "track"
}

func (i searchResultItem) Title() string       { return i.title }
func (i searchResultItem) Description() string { return i.description }
func (i searchResultItem) FilterValue() string { return i.title }

// --- Messages ---

type searchResultsMsg struct {
	items []list.Item
	query string
}

type searchErrMsg struct {
	err error
}

// --- Search Model ---

type searchModel struct {
	client *client.Client
	width  int
	height int

	input       textinput.Model
	resultList  list.Model
	focus       searchFocus
	lastQuery   string
	loading     bool
	err         string
	hasResults  bool
	resultCount int
}

func newSearchModel(c *client.Client) searchModel {
	ti := textinput.New()
	ti.Placeholder = "Search artists, albums, tracks..."
	ti.CharLimit = 256
	ti.Width = 60

	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = delegate.Styles.SelectedTitle.
		Foreground(lipgloss.Color("205")).
		BorderLeftForeground(lipgloss.Color("205"))
	delegate.Styles.SelectedDesc = delegate.Styles.SelectedDesc.
		Foreground(lipgloss.Color("241")).
		BorderLeftForeground(lipgloss.Color("205"))

	resultList := list.New(nil, delegate, 0, 0)
	resultList.Title = "Search Results"
	resultList.SetShowStatusBar(true)
	resultList.SetFilteringEnabled(false)
	resultList.SetShowHelp(false)
	resultList.DisableQuitKeybindings()

	return searchModel{
		client:     c,
		input:      ti,
		resultList: resultList,
		focus:      focusInput,
	}
}

func (m searchModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m searchModel) update(msg tea.Msg) (searchModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		listHeight := msg.Height - 10 // Space for input, padding, status bar.
		if listHeight < 5 {
			listHeight = 5
		}
		m.input.Width = msg.Width - 8
		if m.input.Width < 20 {
			m.input.Width = 20
		}
		m.resultList.SetSize(msg.Width-4, listHeight)
		return m, nil

	case searchResultsMsg:
		m.loading = false
		m.resultList.SetItems(msg.items)
		m.resultCount = len(msg.items)
		m.hasResults = true
		if len(msg.items) > 0 {
			m.resultList.Title = fmt.Sprintf("Results for \"%s\" (%d)", msg.query, len(msg.items))
		} else {
			m.resultList.Title = fmt.Sprintf("No results for \"%s\"", msg.query)
		}
		return m, nil

	case searchErrMsg:
		m.loading = false
		m.err = msg.err.Error()
		return m, nil

	case tea.KeyMsg:
		m.err = ""

		if m.focus == focusInput {
			switch {
			case key.Matches(msg, key.NewBinding(key.WithKeys("enter"))):
				query := strings.TrimSpace(m.input.Value())
				if query == "" {
					return m, nil
				}
				if query == m.lastQuery {
					return m, nil
				}
				m.lastQuery = query
				m.loading = true
				return m, m.doSearch(query)

			case key.Matches(msg, key.NewBinding(key.WithKeys("down"))):
				if m.hasResults && len(m.resultList.Items()) > 0 {
					m.focus = focusResults
					m.input.Blur()
					return m, nil
				}

			case key.Matches(msg, key.NewBinding(key.WithKeys("esc"))):
				// Blur input so app-level keys (tab switching, quit) work again.
				// Press "/" to re-focus the input.
				m.focus = focusResults
				m.input.Blur()
				return m, nil
			}

			// Delegate to text input.
			var cmd tea.Cmd
			m.input, cmd = m.input.Update(msg)
			return m, cmd
		}

		// Focus is on results.
		switch {
		case key.Matches(msg, key.NewBinding(key.WithKeys("esc"))):
			m.focus = focusInput
			return m, m.input.Focus()

		case key.Matches(msg, key.NewBinding(key.WithKeys("/"))):
			m.focus = focusInput
			return m, m.input.Focus()
		}

		// Delegate to list.
		var cmd tea.Cmd
		m.resultList, cmd = m.resultList.Update(msg)
		return m, cmd
	}

	// Non-key messages: update the active component.
	if m.focus == focusInput {
		var cmd tea.Cmd
		m.input, cmd = m.input.Update(msg)
		return m, cmd
	}

	var cmd tea.Cmd
	m.resultList, cmd = m.resultList.Update(msg)
	return m, cmd
}

func (m searchModel) doSearch(query string) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		result, err := c.Search(ctx, query, "all")
		if err != nil {
			return searchErrMsg{err: err}
		}

		var items []list.Item

		// Group artists.
		if len(result.Artists) > 0 {
			for _, a := range result.Artists {
				items = append(items, searchResultItem{
					listItem: listItem{
						id:          a.ID,
						title:       a.Name,
						description: "Artist",
					},
					resultType: "artist",
				})
			}
		}

		// Group albums.
		if len(result.Albums) > 0 {
			for _, a := range result.Albums {
				yearStr := ""
				if a.Year > 0 {
					yearStr = fmt.Sprintf(" (%d)", a.Year)
				}
				items = append(items, searchResultItem{
					listItem: listItem{
						id:          a.ID,
						title:       a.Name + yearStr,
						description: fmt.Sprintf("Album by %s, %d tracks", a.ArtistName, a.TrackCount),
					},
					resultType: "album",
				})
			}
		}

		// Group tracks.
		if len(result.Tracks) > 0 {
			for _, t := range result.Tracks {
				items = append(items, searchResultItem{
					listItem: listItem{
						id:          t.ID,
						title:       t.Title,
						description: fmt.Sprintf("Track by %s — %s (%s)", t.ArtistName, t.AlbumName, formatDuration(t.DurationSeconds)),
					},
					resultType: "track",
				})
			}
		}

		return searchResultsMsg{items: items, query: query}
	}
}

// onActivate is called when the search tab becomes active.
func (m searchModel) onActivate() (searchModel, tea.Cmd) {
	m.focus = focusInput
	return m, m.input.Focus()
}

func (m searchModel) view() string {
	var b strings.Builder

	// Search input area.
	inputLabel := lipgloss.NewStyle().
		Foreground(lipgloss.Color("205")).
		Bold(true).
		Render("Search: ")
	b.WriteString(inputLabel)
	b.WriteString(m.input.View())
	b.WriteString("\n\n")

	if m.loading {
		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("205")).Render("Searching..."))
		return b.String()
	}

	if m.err != "" {
		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render("Error: " + m.err))
		return b.String()
	}

	if m.hasResults {
		b.WriteString(m.resultList.View())
	} else if m.lastQuery == "" {
		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("241")).Render("Type a query and press Enter to search."))
	}

	return b.String()
}

func (m searchModel) statusHints() string {
	if m.focus == focusInput {
		return "[enter] search  [down] results  [esc] unfocus  [1-4] tabs  [q] quit"
	}
	return "[esc] back to input  [/] search  [j/k] navigate  [1-4] tabs  [q] quit"
}
