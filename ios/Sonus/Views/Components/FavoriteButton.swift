import SwiftUI

/// A heart button that toggles favorite status with haptic feedback.
struct FavoriteButton: View {
    let itemType: String
    let itemID: String
    let favoritesViewModel: FavoritesViewModel

    var body: some View {
        let isFavorite = favoritesViewModel.isFavorite(type: itemType, id: itemID)

        Button {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()
            Task {
                await favoritesViewModel.toggleFavorite(type: itemType, id: itemID)
            }
        } label: {
            Image(systemName: isFavorite ? "heart.fill" : "heart")
                .foregroundStyle(isFavorite ? .pink : .secondary)
                .font(.title3)
                .contentTransition(.symbolEffect(.replace))
        }
        .buttonStyle(.plain)
    }
}
