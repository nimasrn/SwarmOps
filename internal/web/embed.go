// Package web serves the compiled React application from the Go control plane.
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"path"
	"strings"
)

// static/index.html is a small tracked fallback for Go-only checks. Docker
// builds replace static with the Vite output before compiling the API image.
//
//go:embed all:static
var assets embed.FS

func Handler() http.Handler {
	content, err := fs.Sub(assets, "static")
	if err != nil {
		panic(err)
	}
	files := http.FileServer(http.FS(content))
	return http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		name := strings.TrimPrefix(path.Clean(request.URL.Path), "/")
		if name == "." || name == "" {
			http.ServeFileFS(response, request, content, "index.html")
			return
		}
		if _, err := fs.Stat(content, name); err == nil {
			files.ServeHTTP(response, request)
			return
		}
		http.ServeFileFS(response, request, content, "index.html")
	})
}
