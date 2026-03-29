import Foundation
import Observation

/// The authentication state of the app.
enum AuthState {
    case loading
    case unauthenticated
    case authenticated
}

/// AppState manages global application state including authentication.
/// Uses @Observable (Swift 5.9+ Observation framework) instead of ObservableObject.
@Observable
final class AppState {
    var authState: AuthState = .loading
    var serverURL: String = ""
    var errorMessage: String?

    private(set) var authService: AuthService?
    private(set) var apiClient: APIClient?

    private let keychain = KeychainHelper()

    /// Check if we have existing tokens and a saved server URL.
    func checkExistingAuth() async {
        let savedURL = UserDefaults.standard.string(forKey: "serverURL") ?? ""
        guard !savedURL.isEmpty,
              keychain.read(key: .accessToken) != nil else {
            authState = .unauthenticated
            return
        }

        serverURL = savedURL
        configureServices(baseURL: savedURL)
        authState = .authenticated
    }

    /// Log in to the server.
    func login(serverURL: String, username: String, password: String) async throws {
        let trimmedURL = serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        self.serverURL = trimmedURL
        configureServices(baseURL: trimmedURL)

        guard let authService else {
            throw AppError.notConfigured
        }

        try await authService.login(username: username, password: password)

        UserDefaults.standard.set(trimmedURL, forKey: "serverURL")
        authState = .authenticated
    }

    /// Register a new account on the server.
    func register(serverURL: String, username: String, password: String) async throws {
        let trimmedURL = serverURL.trimmingCharacters(in: CharacterSet(charactersIn: "/ "))
        self.serverURL = trimmedURL
        configureServices(baseURL: trimmedURL)

        guard let authService else {
            throw AppError.notConfigured
        }

        try await authService.register(username: username, password: password)

        UserDefaults.standard.set(trimmedURL, forKey: "serverURL")
        authState = .authenticated
    }

    /// Log out: clear tokens and return to login screen.
    func logout() async {
        authService?.logout()
        serverURL = ""
        UserDefaults.standard.removeObject(forKey: "serverURL")
        authState = .unauthenticated
    }

    // MARK: - Private

    private func configureServices(baseURL: String) {
        let client = APIClient(baseURL: baseURL, keychain: keychain)
        let auth = AuthService(apiClient: client, keychain: keychain)
        client.tokenRefresher = auth
        self.apiClient = client
        self.authService = auth
    }
}

/// App-level errors.
enum AppError: LocalizedError {
    case notConfigured

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Services not configured. Please enter a server URL."
        }
    }
}
