.PHONY: build build-server build-tui build-web dev test clean

# Build all components
build: build-web build-server build-tui

build-server:
	go build -o sonus ./cmd/server

build-tui:
	go build -o sonus-tui ./cmd/tui

build-web:
	cd web && npm run build

# Development
dev:
	@echo "Starting backend and frontend dev servers..."
	@cd web && npm run dev &
	@go run ./cmd/server

# Tests
test:
	go test ./...
	cd web && npm test

# Clean build artifacts
clean:
	rm -f sonus sonus-tui
	rm -rf web/dist
