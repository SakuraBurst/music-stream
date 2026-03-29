package service

import (
	"testing"
)

func TestApplyOverride_AllFields(t *testing.T) {
	meta := TrackMeta{
		Title:       "Original Title",
		Artist:      "Original Artist",
		Album:       "Original Album",
		TrackNumber: 1,
	}

	override := MetadataOverride{
		Filename:    "test.flac",
		Title:       "New Title",
		Artist:      "New Artist",
		Album:       "New Album",
		TrackNumber: 5,
	}

	meta.ApplyOverride(override)

	if meta.Title != "New Title" {
		t.Errorf("expected Title=%q, got %q", "New Title", meta.Title)
	}
	if meta.Artist != "New Artist" {
		t.Errorf("expected Artist=%q, got %q", "New Artist", meta.Artist)
	}
	if meta.Album != "New Album" {
		t.Errorf("expected Album=%q, got %q", "New Album", meta.Album)
	}
	if meta.TrackNumber != 5 {
		t.Errorf("expected TrackNumber=%d, got %d", 5, meta.TrackNumber)
	}
}

func TestApplyOverride_PartialFields(t *testing.T) {
	meta := TrackMeta{
		Title:       "Original Title",
		Artist:      "Original Artist",
		Album:       "Original Album",
		TrackNumber: 3,
	}

	// Only override title and track number; leave artist and album intact.
	override := MetadataOverride{
		Filename:    "test.flac",
		Title:       "New Title",
		TrackNumber: 7,
	}

	meta.ApplyOverride(override)

	if meta.Title != "New Title" {
		t.Errorf("expected Title=%q, got %q", "New Title", meta.Title)
	}
	if meta.Artist != "Original Artist" {
		t.Errorf("expected Artist=%q, got %q", "Original Artist", meta.Artist)
	}
	if meta.Album != "Original Album" {
		t.Errorf("expected Album=%q, got %q", "Original Album", meta.Album)
	}
	if meta.TrackNumber != 7 {
		t.Errorf("expected TrackNumber=%d, got %d", 7, meta.TrackNumber)
	}
}

func TestApplyOverride_EmptyOverride(t *testing.T) {
	meta := TrackMeta{
		Title:       "Original Title",
		Artist:      "Original Artist",
		Album:       "Original Album",
		TrackNumber: 3,
		Genre:       "Rock",
		Year:        2024,
	}

	// Empty override should not change anything.
	override := MetadataOverride{}

	meta.ApplyOverride(override)

	if meta.Title != "Original Title" {
		t.Errorf("expected Title=%q, got %q", "Original Title", meta.Title)
	}
	if meta.Artist != "Original Artist" {
		t.Errorf("expected Artist=%q, got %q", "Original Artist", meta.Artist)
	}
	if meta.Album != "Original Album" {
		t.Errorf("expected Album=%q, got %q", "Original Album", meta.Album)
	}
	if meta.TrackNumber != 3 {
		t.Errorf("expected TrackNumber=%d, got %d", 3, meta.TrackNumber)
	}
	// Fields not in MetadataOverride should be untouched.
	if meta.Genre != "Rock" {
		t.Errorf("expected Genre=%q, got %q", "Rock", meta.Genre)
	}
	if meta.Year != 2024 {
		t.Errorf("expected Year=%d, got %d", 2024, meta.Year)
	}
}

func TestApplyOverride_OnEmptyMeta(t *testing.T) {
	meta := TrackMeta{}

	override := MetadataOverride{
		Title:       "New Title",
		Artist:      "New Artist",
		Album:       "New Album",
		TrackNumber: 1,
	}

	meta.ApplyOverride(override)

	if meta.Title != "New Title" {
		t.Errorf("expected Title=%q, got %q", "New Title", meta.Title)
	}
	if meta.Artist != "New Artist" {
		t.Errorf("expected Artist=%q, got %q", "New Artist", meta.Artist)
	}
	if meta.Album != "New Album" {
		t.Errorf("expected Album=%q, got %q", "New Album", meta.Album)
	}
	if meta.TrackNumber != 1 {
		t.Errorf("expected TrackNumber=%d, got %d", 1, meta.TrackNumber)
	}
}
