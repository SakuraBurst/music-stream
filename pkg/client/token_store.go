package client

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// StoredTokens is the JSON structure persisted to the token file.
type StoredTokens struct {
	ServerURL    string `json:"serverURL"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

// DefaultTokenPath returns the default path for the token file:
// ~/.config/sonus/token.json
func DefaultTokenPath() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("getting user config dir: %w", err)
	}
	return filepath.Join(configDir, "sonus", "token.json"), nil
}

// SaveTokens writes tokens to the given file path, creating parent directories
// as needed. The file is created with 0600 permissions.
func SaveTokens(path string, tokens *StoredTokens) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("creating token directory: %w", err)
	}

	data, err := json.MarshalIndent(tokens, "", "  ")
	if err != nil {
		return fmt.Errorf("marshaling tokens: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("writing token file: %w", err)
	}

	return nil
}

// LoadTokens reads tokens from the given file path.
// Returns nil, nil if the file does not exist.
func LoadTokens(path string) (*StoredTokens, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("reading token file: %w", err)
	}

	var tokens StoredTokens
	if err := json.Unmarshal(data, &tokens); err != nil {
		return nil, fmt.Errorf("parsing token file: %w", err)
	}

	return &tokens, nil
}
