import Foundation

/// AuthService handles login, register, token refresh, and logout.
/// Stores and clears tokens via KeychainHelper.
final class AuthService: TokenRefreshing, Sendable {
    private let apiClient: APIClient
    private let keychain: KeychainHelper

    init(apiClient: APIClient, keychain: KeychainHelper) {
        self.apiClient = apiClient
        self.keychain = keychain
    }

    /// Log in with username and password. Stores tokens in Keychain on success.
    func login(username: String, password: String) async throws {
        let body = AuthRequest(username: username, password: password)
        let response: AuthResponse = try await apiClient.requestNoAuth(
            endpoint: "/api/v1/auth/login",
            method: .post,
            body: body
        )
        storeTokens(response)
    }

    /// Register a new account. Stores tokens in Keychain on success.
    func register(username: String, password: String) async throws {
        let body = AuthRequest(username: username, password: password)
        let response: AuthResponse = try await apiClient.requestNoAuth(
            endpoint: "/api/v1/auth/register",
            method: .post,
            body: body
        )
        storeTokens(response)
    }

    /// Refresh the access token using the stored refresh token.
    /// Called automatically by APIClient on 401.
    func refreshAccessToken() async throws {
        guard let refreshToken = keychain.read(key: .refreshToken) else {
            throw APIError.unauthorized
        }

        let body = RefreshTokenRequest(refreshToken: refreshToken)
        let response: AuthResponse = try await apiClient.requestNoAuth(
            endpoint: "/api/v1/auth/refresh",
            method: .post,
            body: body
        )
        storeTokens(response)
    }

    /// Log out: clear all tokens from Keychain.
    func logout() {
        keychain.deleteAll()
    }

    // MARK: - Private

    private func storeTokens(_ response: AuthResponse) {
        keychain.save(key: .accessToken, value: response.accessToken)
        keychain.save(key: .refreshToken, value: response.refreshToken)
    }
}
