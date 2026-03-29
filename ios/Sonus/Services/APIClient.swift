import Foundation

/// HTTP methods used by the API client.
enum HTTPMethod: String, Sendable {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
}

/// Errors thrown by APIClient.
enum APIError: LocalizedError, Sendable {
    case invalidURL
    case invalidResponse
    case unauthorized
    case conflict(String)
    case forbidden(String)
    case notFound
    case serverError(String)
    case decodingError(String)
    case networkError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL."
        case .invalidResponse:
            return "Invalid response from server."
        case .unauthorized:
            return "Authentication failed. Please log in again."
        case .conflict(let message):
            return message
        case .forbidden(let message):
            return message
        case .notFound:
            return "Resource not found."
        case .serverError(let message):
            return "Server error: \(message)"
        case .decodingError(let message):
            return "Failed to decode response: \(message)"
        case .networkError(let message):
            return "Network error: \(message)"
        }
    }
}

/// Protocol for token refresh capability, used to break the circular dependency
/// between APIClient and AuthService.
protocol TokenRefreshing: AnyObject, Sendable {
    func refreshAccessToken() async throws
}

/// URLSession-based API client with automatic JWT injection and token refresh on 401.
/// @unchecked Sendable: URLSession, JSONDecoder, JSONEncoder are thread-safe in practice
/// but not marked Sendable in Foundation. All stored properties are either immutable or
/// explicitly marked nonisolated(unsafe) with a documented single-write pattern.
final class APIClient: @unchecked Sendable {
    let baseURL: String
    let keychain: KeychainHelper
    private let session: URLSession

    /// Set by AppState after both APIClient and AuthService are created.
    /// Uses nonisolated(unsafe) because this is set exactly once during init wiring.
    nonisolated(unsafe) var tokenRefresher: TokenRefreshing?

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)

            // Try ISO 8601 with fractional seconds first, then without.
            if let date = ISO8601DateFormatter.withFractionalSeconds.date(from: string) {
                return date
            }
            if let date = ISO8601DateFormatter.standard.date(from: string) {
                return date
            }
            // Try Go's default time format (has timezone offset like +00:00).
            if let date = DateFormatter.goDefault.date(from: string) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(string)"
            )
        }
        return d
    }()

    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        return e
    }()

    init(baseURL: String, keychain: KeychainHelper) {
        self.baseURL = baseURL
        self.keychain = keychain

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)
    }

    // MARK: - Public API

    /// Perform an authenticated request that expects a decoded response.
    func request<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: (any Encodable)? = nil
    ) async throws -> T {
        let data = try await performRequest(
            endpoint: endpoint,
            method: method,
            body: body,
            authenticated: true
        )
        return try decodeResponse(data)
    }

    /// Perform an unauthenticated request (for login/register).
    func requestNoAuth<T: Decodable>(
        endpoint: String,
        method: HTTPMethod = .get,
        body: (any Encodable)? = nil
    ) async throws -> T {
        let data = try await performRequest(
            endpoint: endpoint,
            method: method,
            body: body,
            authenticated: false
        )
        return try decodeResponse(data)
    }

    /// Perform a request that returns no body (e.g., DELETE).
    func requestVoid(
        endpoint: String,
        method: HTTPMethod = .get,
        body: (any Encodable)? = nil
    ) async throws {
        _ = try await performRequest(
            endpoint: endpoint,
            method: method,
            body: body,
            authenticated: true
        )
    }

    /// Build a full URL for streaming/cover art endpoints that need a token query param.
    func urlWithToken(endpoint: String) -> URL? {
        guard var components = URLComponents(string: "\(baseURL)\(endpoint)") else {
            return nil
        }
        if let token = keychain.read(key: .accessToken) {
            let existing = components.queryItems ?? []
            components.queryItems = existing + [URLQueryItem(name: "token", value: token)]
        }
        return components.url
    }

    // MARK: - Private

    private func performRequest(
        endpoint: String,
        method: HTTPMethod,
        body: (any Encodable)?,
        authenticated: Bool
    ) async throws -> Data {
        guard let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw APIError.invalidURL
        }

        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = method.rawValue
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if authenticated, let token = keychain.read(key: .accessToken) {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            urlRequest.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await session.data(for: urlRequest)
        } catch {
            throw APIError.networkError(error.localizedDescription)
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        // Automatic token refresh on 401 for authenticated requests.
        if httpResponse.statusCode == 401 && authenticated {
            if let refresher = tokenRefresher {
                try await refresher.refreshAccessToken()

                // Retry with new token.
                if let newToken = keychain.read(key: .accessToken) {
                    urlRequest.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                }

                let (retryData, retryResponse) = try await session.data(for: urlRequest)
                guard let retryHTTP = retryResponse as? HTTPURLResponse else {
                    throw APIError.invalidResponse
                }

                // If still 401 after refresh, give up.
                if retryHTTP.statusCode == 401 {
                    throw APIError.unauthorized
                }

                try checkStatusCode(retryHTTP, data: retryData)
                return retryData
            }
            throw APIError.unauthorized
        }

        try checkStatusCode(httpResponse, data: data)
        return data
    }

    private func checkStatusCode(_ response: HTTPURLResponse, data: Data) throws {
        switch response.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 403:
            let msg = parseErrorMessage(data) ?? "Forbidden"
            throw APIError.forbidden(msg)
        case 404:
            throw APIError.notFound
        case 409:
            let msg = parseErrorMessage(data) ?? "Conflict"
            throw APIError.conflict(msg)
        default:
            let msg = parseErrorMessage(data) ?? "Unknown error (HTTP \(response.statusCode))"
            throw APIError.serverError(msg)
        }
    }

    private func parseErrorMessage(_ data: Data) -> String? {
        try? decoder.decode(APIErrorResponse.self, from: data).error
    }

    private func decodeResponse<T: Decodable>(_ data: Data) throws -> T {
        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decodingError(error.localizedDescription)
        }
    }
}

// MARK: - Date Formatters

extension ISO8601DateFormatter {
    /// ISO 8601 with fractional seconds (e.g., "2024-01-15T10:30:00.000Z").
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// ISO 8601 standard (e.g., "2024-01-15T10:30:00Z").
    static let standard: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}

extension DateFormatter {
    /// Go's default time.Time JSON format: "2006-01-02T15:04:05.999999999-07:00".
    static let goDefault: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSSSSSSSZZZZZ"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()
}

// MARK: - AnyEncodable

/// Type-erasing wrapper for Encodable values, needed because JSONEncoder.encode()
/// requires a concrete type, not `any Encodable`.
private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ value: any Encodable) {
        self.encodeClosure = { encoder in
            try value.encode(to: encoder)
        }
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
