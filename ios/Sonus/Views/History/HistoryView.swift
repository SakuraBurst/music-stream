import SwiftUI

/// Displays the user's recent listening history with pagination.
struct HistoryView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel: HistoryViewModel
    let playerService: AudioPlayerService

    init(apiClient: APIClient, playerService: AudioPlayerService) {
        _viewModel = State(initialValue: HistoryViewModel(apiClient: apiClient))
        self.playerService = playerService
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.entries.isEmpty {
                ProgressView("Loading history...")
            } else if let error = viewModel.error, viewModel.entries.isEmpty {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                } actions: {
                    Button("Retry") {
                        Task { await viewModel.loadHistory() }
                    }
                    .buttonStyle(.bordered)
                }
            } else if viewModel.entries.isEmpty {
                ContentUnavailableView(
                    "No History",
                    systemImage: "clock",
                    description: Text("Your listening history will appear here.")
                )
            } else {
                historyList
            }
        }
        .navigationTitle("History")
        .task {
            if viewModel.entries.isEmpty {
                await viewModel.loadHistory()
            }
        }
        .refreshable {
            await viewModel.loadHistory()
        }
    }

    private var historyList: some View {
        List {
            ForEach(viewModel.entries, id: \.id) { entry in
                HistoryRow(entry: entry)
            }

            if viewModel.hasMore {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .listRowSeparator(.hidden)
                    .task {
                        await viewModel.loadMore()
                    }
            }
        }
        .listStyle(.plain)
    }
}

// MARK: - History Row

struct HistoryRow: View {
    let entry: HistoryEntry

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "clock")
                .font(.title3)
                .foregroundStyle(.secondary)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text("Track ID: \(entry.trackId)")
                    .font(.body)
                    .lineLimit(1)

                Text(formatDate(entry.playedAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if let duration = entry.durationSeconds, duration > 0 {
                Text(formatDuration(duration))
                    .font(.subheadline.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }

    private func formatDuration(_ totalSeconds: Int) -> String {
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
