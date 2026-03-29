package handler

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/sakuraburst/sonus/internal/service"
)

// AdminHandler handles admin HTTP endpoints.
type AdminHandler struct {
	scanner *service.ScannerService
	logger  *slog.Logger
}

// NewAdminHandler creates a new AdminHandler.
func NewAdminHandler(scanner *service.ScannerService, logger *slog.Logger) *AdminHandler {
	return &AdminHandler{
		scanner: scanner,
		logger:  logger,
	}
}

// StartScan handles POST /api/v1/admin/scan.
func (h *AdminHandler) StartScan(w http.ResponseWriter, r *http.Request) {
	// Launch scan in a background goroutine with a detached context
	// so the scan is not cancelled when the HTTP response is sent.
	go func() {
		if _, err := h.scanner.Scan(context.Background()); err != nil {
			h.logger.Error("library scan failed", "error", err)
		}
	}()

	writeJSON(w, http.StatusAccepted, map[string]string{"message": "scan started"})
}

// ScanStatus handles GET /api/v1/admin/scan/status.
func (h *AdminHandler) ScanStatus(w http.ResponseWriter, r *http.Request) {
	status := h.scanner.Status()
	writeJSON(w, http.StatusOK, status)
}
