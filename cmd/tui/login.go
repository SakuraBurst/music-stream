package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/sakuraburst/sonus/pkg/client"
)

// loginField identifies which input field is focused.
type loginField int

const (
	fieldServerURL loginField = iota
	fieldUsername
	fieldPassword
	loginFieldCount
)

// loginModel handles the login/registration screen.
type loginModel struct {
	inputs    []textinput.Model
	focused   loginField
	err       string
	loading   bool
	tokenPath string

	width  int
	height int
}

// loginResultMsg carries the result of a login attempt.
type loginResultMsg struct {
	client *client.Client
	err    error
}

func newLoginModel() loginModel {
	inputs := make([]textinput.Model, loginFieldCount)

	serverInput := textinput.New()
	serverInput.Placeholder = "http://localhost:8080"
	serverInput.Focus()
	serverInput.CharLimit = 256
	serverInput.Width = 40
	inputs[fieldServerURL] = serverInput

	usernameInput := textinput.New()
	usernameInput.Placeholder = "username"
	usernameInput.CharLimit = 64
	usernameInput.Width = 40
	inputs[fieldUsername] = usernameInput

	passwordInput := textinput.New()
	passwordInput.Placeholder = "password"
	passwordInput.EchoMode = textinput.EchoPassword
	passwordInput.EchoCharacter = '*'
	passwordInput.CharLimit = 128
	passwordInput.Width = 40
	inputs[fieldPassword] = passwordInput

	return loginModel{
		inputs:  inputs,
		focused: fieldServerURL,
	}
}

func (m loginModel) Init() tea.Cmd {
	return textinput.Blink
}

func (m loginModel) update(msg tea.Msg) (loginModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		// Clear error on any key press.
		m.err = ""

		switch msg.String() {
		case "enter":
			if m.loading {
				return m, nil
			}
			// If on the last field, attempt login.
			if m.focused == fieldPassword {
				return m.attemptLogin()
			}
			// Otherwise, move to next field.
			m.focused++
			return m.updateFocus()

		case "tab", "down":
			if m.loading {
				return m, nil
			}
			m.focused = (m.focused + 1) % loginFieldCount
			return m.updateFocus()

		case "shift+tab", "up":
			if m.loading {
				return m, nil
			}
			m.focused = (m.focused - 1 + loginFieldCount) % loginFieldCount
			return m.updateFocus()
		}

	case loginResultMsg:
		m.loading = false
		if msg.err != nil {
			m.err = msg.err.Error()
			return m, nil
		}
		// Login succeeded — notify the parent.
		return m, func() tea.Msg { return loginDoneMsg{client: msg.client} }
	}

	// Update the focused input.
	if !m.loading {
		var cmd tea.Cmd
		m.inputs[m.focused], cmd = m.inputs[m.focused].Update(msg)
		return m, cmd
	}

	return m, nil
}

func (m loginModel) updateFocus() (loginModel, tea.Cmd) {
	cmds := make([]tea.Cmd, len(m.inputs))
	for i := range m.inputs {
		if loginField(i) == m.focused {
			cmds[i] = m.inputs[i].Focus()
		} else {
			m.inputs[i].Blur()
		}
	}
	return m, tea.Batch(cmds...)
}

func (m loginModel) attemptLogin() (loginModel, tea.Cmd) {
	serverURL := strings.TrimSpace(m.inputs[fieldServerURL].Value())
	username := strings.TrimSpace(m.inputs[fieldUsername].Value())
	password := m.inputs[fieldPassword].Value()

	if serverURL == "" {
		m.err = "Server URL is required"
		return m, nil
	}
	if username == "" {
		m.err = "Username is required"
		return m, nil
	}
	if password == "" {
		m.err = "Password is required"
		return m, nil
	}

	// Strip trailing slash from server URL.
	serverURL = strings.TrimRight(serverURL, "/")

	m.loading = true
	tokenPath := m.tokenPath

	return m, func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		apiClient := client.New(serverURL)
		tokens, err := apiClient.Login(ctx, username, password)
		if err != nil {
			return loginResultMsg{err: fmt.Errorf("login failed: %w", err)}
		}

		// Save tokens to file.
		if tokenPath == "" {
			tokenPath, _ = client.DefaultTokenPath()
		}
		if tokenPath != "" {
			_ = client.SaveTokens(tokenPath, &client.StoredTokens{
				ServerURL:    serverURL,
				AccessToken:  tokens.AccessToken,
				RefreshToken: tokens.RefreshToken,
			})
		}

		return loginResultMsg{client: apiClient}
	}
}

// Styles for the login screen.
var (
	loginTitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("205")).
			MarginBottom(1)

	loginLabelStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("252")).
			Width(12)

	loginErrStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("196")).
			MarginTop(1)

	loginHelpStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("241")).
			MarginTop(1)

	loginBoxStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("238")).
			Padding(1, 3)
)

func (m loginModel) view() string {
	var b strings.Builder

	b.WriteString(loginTitleStyle.Render("Sonus"))
	b.WriteString("\n\n")

	labels := []string{"Server URL", "Username", "Password"}
	for i, input := range m.inputs {
		label := loginLabelStyle.Render(labels[i])
		b.WriteString(label + " " + input.View())
		b.WriteString("\n")
	}

	if m.loading {
		b.WriteString("\n")
		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("205")).Render("Connecting..."))
	}

	if m.err != "" {
		b.WriteString(loginErrStyle.Render(m.err))
	}

	b.WriteString(loginHelpStyle.Render("\n[enter] login  [tab] next field  [ctrl+c] quit"))

	content := loginBoxStyle.Render(b.String())

	// Center the login box.
	if m.width > 0 && m.height > 0 {
		return lipgloss.Place(m.width, m.height,
			lipgloss.Center, lipgloss.Center,
			content,
		)
	}

	return content
}
