package main

import (
	"fmt"
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/sakuraburst/sonus/pkg/client"
)

func main() {
	// Try to load saved session.
	tokenPath, err := client.DefaultTokenPath()
	if err != nil {
		log.Fatalf("Error determining config path: %v", err)
	}

	var apiClient *client.Client
	var needLogin bool

	stored, err := client.LoadTokens(tokenPath)
	if err != nil {
		log.Fatalf("Error loading tokens: %v", err)
	}

	if stored != nil && stored.ServerURL != "" && stored.RefreshToken != "" {
		apiClient = client.New(stored.ServerURL)
		apiClient.SetTokens(stored.AccessToken, stored.RefreshToken)
		needLogin = false
	} else {
		needLogin = true
	}

	model := newAppModel(apiClient, tokenPath, needLogin)

	p := tea.NewProgram(model, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error running TUI: %v\n", err)
		os.Exit(1)
	}
}
