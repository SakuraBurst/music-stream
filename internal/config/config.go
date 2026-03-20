package config

import (
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/knadh/koanf/parsers/toml"
	"github.com/knadh/koanf/providers/basicflag"
	"github.com/knadh/koanf/providers/env"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/v2"
)

// Config holds all configuration for the Sonus server.
type Config struct {
	Dev         bool              `koanf:"dev"`
	Server      ServerConfig      `koanf:"server"`
	Library     LibraryConfig     `koanf:"library"`
	Transcoding TranscodingConfig `koanf:"transcoding"`
	Auth        AuthConfig        `koanf:"auth"`
}

type ServerConfig struct {
	Address string `koanf:"address"`
	DataDir string `koanf:"data_dir"`
}

type LibraryConfig struct {
	MusicDirs      []string `koanf:"music_dirs"`
	ScanOnStartup  bool     `koanf:"scan_on_startup"`
	ScanInterval   string   `koanf:"scan_interval"`
}

type TranscodingConfig struct {
	FFmpegPath   string `koanf:"ffmpeg_path"`
	CacheMaxSize string `koanf:"cache_max_size"`
	DefaultFormat  string `koanf:"default_format"`
	DefaultBitrate int    `koanf:"default_bitrate"`
}

// ParsedCacheMaxSize parses the cache_max_size value (e.g., "10GB", "500MB")
// and returns the size in bytes. Supported suffixes: B, KB, MB, GB, TB (case-insensitive).
// Returns 10GB if the value cannot be parsed.
func (c *TranscodingConfig) ParsedCacheMaxSize() int64 {
	s := strings.TrimSpace(c.CacheMaxSize)
	if s == "" {
		return 10 * 1024 * 1024 * 1024 // 10 GB
	}

	s = strings.ToUpper(s)

	multipliers := []struct {
		suffix     string
		multiplier int64
	}{
		{"TB", 1024 * 1024 * 1024 * 1024},
		{"GB", 1024 * 1024 * 1024},
		{"MB", 1024 * 1024},
		{"KB", 1024},
		{"B", 1},
	}

	for _, m := range multipliers {
		if strings.HasSuffix(s, m.suffix) {
			numStr := strings.TrimSpace(strings.TrimSuffix(s, m.suffix))
			val, err := strconv.ParseFloat(numStr, 64)
			if err != nil {
				return 10 * 1024 * 1024 * 1024
			}
			return int64(val * float64(m.multiplier))
		}
	}

	// Try parsing as raw bytes.
	val, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 10 * 1024 * 1024 * 1024
	}
	return val
}

type AuthConfig struct {
	JWTSecret           string `koanf:"jwt_secret"`
	AccessTokenTTL      string `koanf:"access_token_ttl"`
	RefreshTokenTTL     string `koanf:"refresh_token_ttl"`
	RegistrationEnabled bool   `koanf:"registration_enabled"`
}

// ParsedDurations returns parsed time.Duration values for TTL fields.
func (c *AuthConfig) ParsedAccessTokenTTL() time.Duration {
	d, err := time.ParseDuration(c.AccessTokenTTL)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}

func (c *AuthConfig) ParsedRefreshTokenTTL() time.Duration {
	d, err := time.ParseDuration(c.RefreshTokenTTL)
	if err != nil {
		return 720 * time.Hour
	}
	return d
}

func (c *LibraryConfig) ParsedScanInterval() time.Duration {
	d, err := time.ParseDuration(c.ScanInterval)
	if err != nil {
		return 1 * time.Hour
	}
	return d
}

// Load reads configuration from defaults, TOML file, env vars, and CLI flags.
// Priority: defaults < TOML < env < flags.
func Load() (*Config, error) {
	k := koanf.New(".")

	// Pre-parse CLI flags so --config can influence TOML file path.
	f := flag.NewFlagSet("sonus", flag.ContinueOnError)
	f.String("server.address", "", "HTTP server listen address")
	f.String("server.data_dir", "", "Data directory path")
	f.String("auth.jwt_secret", "", "JWT signing secret")
	f.Bool("auth.registration_enabled", true, "Enable user registration")
	f.String("config", "", "Path to config file (alternative to SONUS_CONFIG_FILE)")

	if err := f.Parse(os.Args[1:]); err != nil {
		return nil, fmt.Errorf("parsing flags: %w", err)
	}

	// 1. Defaults
	defaults := map[string]any{
		"server.address":              ":8080",
		"server.data_dir":             "./data",
		"library.scan_on_startup":     true,
		"library.scan_interval":       "1h",
		"transcoding.ffmpeg_path":     "ffmpeg",
		"transcoding.cache_max_size":  "10GB",
		"transcoding.default_format":  "original",
		"transcoding.default_bitrate": 192,
		"auth.access_token_ttl":       "15m",
		"auth.refresh_token_ttl":      "720h",
		"auth.registration_enabled":   true,
	}
	for key, val := range defaults {
		if err := k.Set(key, val); err != nil {
			return nil, fmt.Errorf("setting default %s: %w", key, err)
		}
	}

	// 2. TOML file (optional). --config flag > SONUS_CONFIG_FILE env > "sonus.toml".
	configPath := f.Lookup("config").Value.String()
	if configPath == "" {
		configPath = os.Getenv("SONUS_CONFIG_FILE")
	}
	if configPath == "" {
		configPath = "sonus.toml"
	}

	if _, err := os.Stat(configPath); err == nil {
		if err := k.Load(file.Provider(configPath), toml.Parser()); err != nil {
			return nil, fmt.Errorf("loading config file %s: %w", configPath, err)
		}
		slog.Info("loaded config file", "path", configPath)
	}

	// 3. Environment variables with SONUS_ prefix.
	// Section names are single words, so the first underscore after the prefix
	// separates section from key. Remaining underscores are literal.
	// Examples:
	//   SONUS_SERVER_ADDRESS       -> server.address
	//   SONUS_SERVER_DATA_DIR      -> server.data_dir
	//   SONUS_LIBRARY_MUSIC_DIRS   -> library.music_dirs
	//   SONUS_AUTH_JWT_SECRET      -> auth.jwt_secret
	if err := k.Load(env.Provider("SONUS_", ".", func(s string) string {
		s = strings.TrimPrefix(s, "SONUS_")
		s = strings.ToLower(s)
		// Split on first underscore only: section.key_with_underscores
		if idx := strings.Index(s, "_"); idx != -1 {
			return s[:idx] + "." + s[idx+1:]
		}
		return s
	}), nil); err != nil {
		return nil, fmt.Errorf("loading env vars: %w", err)
	}

	// 4. CLI flags — only load flags that were explicitly set by the user
	// to avoid empty defaults overriding TOML/env values.
	setFlags := make(map[string]bool)
	f.Visit(func(fl *flag.Flag) {
		setFlags[fl.Name] = true
	})
	if len(setFlags) > 0 {
		if err := k.Load(basicflag.ProviderWithValue(f, ".", func(key, value string) (string, any) {
			if !setFlags[key] || key == "config" {
				// Skip unset flags and the meta "config" flag.
				return "", nil
			}
			return key, value
		}), nil); err != nil {
			return nil, fmt.Errorf("loading flags: %w", err)
		}
	}

	var cfg Config
	if err := k.Unmarshal("", &cfg); err != nil {
		return nil, fmt.Errorf("unmarshaling config: %w", err)
	}

	return &cfg, nil
}

// LogSafe logs the configuration with secrets redacted.
func (c *Config) LogSafe(logger *slog.Logger) {
	jwtDisplay := "<not set>"
	if c.Auth.JWTSecret != "" {
		jwtDisplay = "<redacted>"
	}

	logger.Info("server configuration",
		"dev", c.Dev,
		"server.address", c.Server.Address,
		"server.data_dir", c.Server.DataDir,
		"library.music_dirs", c.Library.MusicDirs,
		"library.scan_on_startup", c.Library.ScanOnStartup,
		"library.scan_interval", c.Library.ScanInterval,
		"transcoding.ffmpeg_path", c.Transcoding.FFmpegPath,
		"transcoding.cache_max_size", c.Transcoding.CacheMaxSize,
		"transcoding.default_format", c.Transcoding.DefaultFormat,
		"transcoding.default_bitrate", c.Transcoding.DefaultBitrate,
		"auth.jwt_secret", jwtDisplay,
		"auth.access_token_ttl", c.Auth.AccessTokenTTL,
		"auth.refresh_token_ttl", c.Auth.RefreshTokenTTL,
		"auth.registration_enabled", c.Auth.RegistrationEnabled,
	)
}
