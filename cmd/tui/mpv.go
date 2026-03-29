package main

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

// mpvInstance manages an mpv subprocess and communicates via JSON IPC.
type mpvInstance struct {
	mu         sync.Mutex
	cmd        *exec.Cmd
	socketPath string
	conn       net.Conn
	requestID  int
}

// mpvStatus holds the current playback status read from mpv.
type mpvStatus struct {
	Position float64 // seconds elapsed
	Duration float64 // total seconds
	Paused   bool
	Volume   float64 // 0-100
	Idle     bool    // true if mpv has nothing to play (track ended)
}

// checkMpvAvailable returns true if mpv is found in PATH.
func checkMpvAvailable() bool {
	_, err := exec.LookPath("mpv")
	return err == nil
}

// newMpvInstance creates a new mpv controller. It does not start mpv yet.
func newMpvInstance() *mpvInstance {
	socketPath := filepath.Join(os.TempDir(), fmt.Sprintf("sonus-mpv-%d.sock", os.Getpid()))
	return &mpvInstance{
		socketPath: socketPath,
	}
}

// Play starts mpv with the given URL. If mpv is already running, it is stopped first.
func (m *mpvInstance) Play(url string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.stopLocked()

	// Remove stale socket file.
	os.Remove(m.socketPath)

	m.cmd = exec.Command("mpv",
		"--no-video",
		"--really-quiet",
		"--no-terminal",
		fmt.Sprintf("--input-ipc-server=%s", m.socketPath),
		url,
	)
	// Detach stdin so mpv doesn't fight with the TUI for terminal input.
	m.cmd.Stdin = nil
	m.cmd.Stdout = nil
	m.cmd.Stderr = nil

	if err := m.cmd.Start(); err != nil {
		return fmt.Errorf("starting mpv: %w", err)
	}

	// Wait for the IPC socket to appear.
	if err := m.waitForSocket(2 * time.Second); err != nil {
		// mpv started but socket didn't appear; kill and report error.
		m.stopLocked()
		return fmt.Errorf("mpv IPC socket not available: %w", err)
	}

	return nil
}

// waitForSocket polls until the IPC socket file exists and is connectable.
func (m *mpvInstance) waitForSocket(timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("unix", m.socketPath, 100*time.Millisecond)
		if err == nil {
			m.conn = conn
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("timeout waiting for socket %s", m.socketPath)
}

// Stop terminates the mpv process and cleans up.
func (m *mpvInstance) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.stopLocked()
}

func (m *mpvInstance) stopLocked() {
	if m.conn != nil {
		m.conn.Close()
		m.conn = nil
	}
	if m.cmd != nil && m.cmd.Process != nil {
		_ = m.cmd.Process.Kill()
		_ = m.cmd.Wait()
		m.cmd = nil
	}
	os.Remove(m.socketPath)
}

// IsRunning returns true if the mpv process is still alive.
func (m *mpvInstance) IsRunning() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.cmd == nil || m.cmd.Process == nil {
		return false
	}
	// Signal(syscall.Signal(0)) checks if the process exists without actually sending a signal.
	err := m.cmd.Process.Signal(syscall.Signal(0))
	return err == nil
}

// sendCommand sends a JSON IPC command to mpv and returns the response.
func (m *mpvInstance) sendCommand(args ...any) (json.RawMessage, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.conn == nil {
		return nil, fmt.Errorf("no IPC connection")
	}

	m.requestID++
	reqID := m.requestID

	cmd := map[string]any{
		"command":    args,
		"request_id": reqID,
	}

	data, err := json.Marshal(cmd)
	if err != nil {
		return nil, fmt.Errorf("marshaling command: %w", err)
	}
	data = append(data, '\n')

	if err := m.conn.SetWriteDeadline(time.Now().Add(1 * time.Second)); err != nil {
		return nil, fmt.Errorf("setting write deadline: %w", err)
	}
	if _, err := m.conn.Write(data); err != nil {
		return nil, fmt.Errorf("writing command: %w", err)
	}

	// Read response line(s). mpv sends events and responses on the same connection.
	// We need to find the response matching our request_id.
	if err := m.conn.SetReadDeadline(time.Now().Add(2 * time.Second)); err != nil {
		return nil, fmt.Errorf("setting read deadline: %w", err)
	}

	buf := make([]byte, 4096)
	for {
		n, err := m.conn.Read(buf)
		if err != nil {
			return nil, fmt.Errorf("reading response: %w", err)
		}

		// mpv may send multiple JSON lines. Parse each one.
		lines := splitLines(buf[:n])
		for _, line := range lines {
			if len(line) == 0 {
				continue
			}
			var resp map[string]json.RawMessage
			if err := json.Unmarshal(line, &resp); err != nil {
				continue
			}
			// Check if this is our response (has request_id matching).
			if ridRaw, ok := resp["request_id"]; ok {
				var rid int
				if json.Unmarshal(ridRaw, &rid) == nil && rid == reqID {
					if dataField, ok := resp["data"]; ok {
						return dataField, nil
					}
					return nil, nil
				}
			}
		}
	}
}

// splitLines splits a byte buffer into individual lines.
func splitLines(data []byte) [][]byte {
	var lines [][]byte
	start := 0
	for i, b := range data {
		if b == '\n' {
			if i > start {
				lines = append(lines, data[start:i])
			}
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, data[start:])
	}
	return lines
}

// GetStatus retrieves the current playback status from mpv.
func (m *mpvInstance) GetStatus() (mpvStatus, error) {
	var status mpvStatus

	// Get time-pos.
	if data, err := m.sendCommand("get_property", "time-pos"); err == nil && data != nil {
		var pos float64
		if json.Unmarshal(data, &pos) == nil {
			status.Position = pos
		}
	}

	// Get duration.
	if data, err := m.sendCommand("get_property", "duration"); err == nil && data != nil {
		var dur float64
		if json.Unmarshal(data, &dur) == nil {
			status.Duration = dur
		}
	}

	// Get pause state.
	if data, err := m.sendCommand("get_property", "pause"); err == nil && data != nil {
		var paused bool
		if json.Unmarshal(data, &paused) == nil {
			status.Paused = paused
		}
	}

	// Get volume.
	if data, err := m.sendCommand("get_property", "volume"); err == nil && data != nil {
		var vol float64
		if json.Unmarshal(data, &vol) == nil {
			status.Volume = vol
		}
	}

	// Get idle-active.
	if data, err := m.sendCommand("get_property", "idle-active"); err == nil && data != nil {
		var idle bool
		if json.Unmarshal(data, &idle) == nil {
			status.Idle = idle
		}
	}

	return status, nil
}

// SetPause sets the pause state.
func (m *mpvInstance) SetPause(paused bool) error {
	_, err := m.sendCommand("set_property", "pause", paused)
	return err
}

// TogglePause toggles the pause state.
func (m *mpvInstance) TogglePause() error {
	_, err := m.sendCommand("cycle", "pause")
	return err
}

// Seek seeks by the given offset in seconds (relative).
func (m *mpvInstance) Seek(seconds float64) error {
	_, err := m.sendCommand("seek", seconds, "relative")
	return err
}

// SetVolume sets the volume (0-100).
func (m *mpvInstance) SetVolume(volume float64) error {
	if volume < 0 {
		volume = 0
	}
	if volume > 100 {
		volume = 100
	}
	_, err := m.sendCommand("set_property", "volume", volume)
	return err
}

// AdjustVolume changes volume by delta.
func (m *mpvInstance) AdjustVolume(delta float64) error {
	_, err := m.sendCommand("add", "volume", delta)
	return err
}
