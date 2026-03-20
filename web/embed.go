package web

import "embed"

// DistFS holds the built React frontend (web/dist/).
// The directory must exist at build time — run "npm run build" in web/ first.
//
//go:embed all:dist
var DistFS embed.FS
