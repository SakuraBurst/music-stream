import Foundation
import SwiftUI

/// Actor-isolated image cache with in-memory (NSCache) and disk persistence.
/// Loads album cover art from the Sonus API with automatic JWT token injection.
actor ImageCache {
    static let shared = ImageCache()

    // NSCache is not Sendable but all access is isolated within this actor.
    private nonisolated(unsafe) let memoryCache = NSCache<NSString, UIImage>()
    private let fileManager = FileManager.default
    private let cacheDirectory: URL
    private let session: URLSession

    private var inFlightTasks: [String: Task<UIImage?, Never>] = [:]

    init() {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
        cacheDirectory = caches.appendingPathComponent("coverart", isDirectory: true)
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)

        let config = URLSessionConfiguration.default
        config.urlCache = nil
        session = URLSession(configuration: config)

        memoryCache.countLimit = 200
        memoryCache.totalCostLimit = 50 * 1024 * 1024 // 50 MB
    }

    /// Load a cover art image for the given album ID.
    /// Returns nil if loading fails or no cover art exists.
    func image(for albumID: String, baseURL: String, token: String?) async -> UIImage? {
        let key = albumID as NSString

        // 1. Check in-memory cache.
        if let cached = memoryCache.object(forKey: key) {
            return cached
        }

        // 2. Check disk cache.
        let diskPath = cacheDirectory.appendingPathComponent(albumID)
        if let data = try? Data(contentsOf: diskPath),
           let diskImage = UIImage(data: data) {
            memoryCache.setObject(diskImage, forKey: key, cost: data.count)
            return diskImage
        }

        // 3. Coalesce in-flight requests for the same album.
        if let existing = inFlightTasks[albumID] {
            return await existing.value
        }

        let task = Task<UIImage?, Never> {
            await self.fetchAndCache(albumID: albumID, baseURL: baseURL, token: token)
        }
        inFlightTasks[albumID] = task

        let result = await task.value
        inFlightTasks[albumID] = nil
        return result
    }

    // MARK: - Private

    private func fetchAndCache(albumID: String, baseURL: String, token: String?) async -> UIImage? {
        var urlString = "\(baseURL)/api/v1/coverart/\(albumID)"
        if let token {
            urlString += "?token=\(token)"
        }
        guard let url = URL(string: urlString) else { return nil }

        guard let (data, response) = try? await session.data(from: url),
              let http = response as? HTTPURLResponse,
              http.statusCode == 200,
              let loadedImage = UIImage(data: data) else {
            return nil
        }

        // Persist to disk.
        let filePath = cacheDirectory.appendingPathComponent(albumID)
        try? data.write(to: filePath)

        // Store in memory.
        let cacheKey = albumID as NSString
        memoryCache.setObject(loadedImage, forKey: cacheKey, cost: data.count)

        return loadedImage
    }

    /// Clear both in-memory and disk caches.
    func clearAll() {
        memoryCache.removeAllObjects()
        try? fileManager.removeItem(at: cacheDirectory)
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }
}

// MARK: - CachedAsyncImage

/// A SwiftUI view that loads and displays a cover art image with caching.
/// Uses ImageCache for in-memory + disk persistence.
struct CachedAsyncImage<Placeholder: View>: View {
    let albumID: String
    let baseURL: String
    let token: String?
    let placeholder: () -> Placeholder

    @State private var image: UIImage?
    @State private var isLoading = false

    init(
        albumID: String,
        baseURL: String,
        token: String?,
        @ViewBuilder placeholder: @escaping () -> Placeholder
    ) {
        self.albumID = albumID
        self.baseURL = baseURL
        self.token = token
        self.placeholder = placeholder
    }

    var body: some View {
        Group {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } else {
                placeholder()
            }
        }
        .task(id: albumID) {
            guard !isLoading else { return }
            isLoading = true
            image = await ImageCache.shared.image(
                for: albumID,
                baseURL: baseURL,
                token: token
            )
            isLoading = false
        }
    }
}
