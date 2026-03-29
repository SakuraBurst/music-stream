import SwiftUI

/// Login screen with server URL, username, and password fields.
struct LoginView: View {
    @Environment(AppState.self) private var appState

    @State private var serverURL: String = ""
    @State private var username: String = ""
    @State private var password: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // App icon and title
                    VStack(spacing: 8) {
                        Image(systemName: "music.note.house.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.tint)
                        Text("Sonus")
                            .font(.largeTitle.bold())
                        Text("Personal Music Streaming")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)
                    .padding(.bottom, 16)

                    // Form fields
                    VStack(spacing: 16) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Server URL")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("https://music.example.com", text: $serverURL)
                                .textFieldStyle(.roundedBorder)
                                .textContentType(.URL)
                                .keyboardType(.URL)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Username")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            TextField("Username", text: $username)
                                .textFieldStyle(.roundedBorder)
                                .textContentType(.username)
                                .autocorrectionDisabled()
                                .textInputAutocapitalization(.never)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Password")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            SecureField("Password", text: $password)
                                .textFieldStyle(.roundedBorder)
                                .textContentType(.password)
                        }
                    }
                    .padding(.horizontal)

                    // Error message
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.callout)
                            .foregroundStyle(.red)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }

                    // Login button
                    Button {
                        Task { await performLogin() }
                    } label: {
                        if isLoading {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Sign In")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!isFormValid || isLoading)
                    .padding(.horizontal)

                    // Register link
                    Button("Create Account") {
                        showRegister = true
                    }
                    .font(.callout)
                }
                .padding(.bottom, 40)
            }
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: $showRegister) {
                RegisterView()
            }
            .onAppear {
                // Pre-fill saved server URL if available.
                if serverURL.isEmpty {
                    serverURL = UserDefaults.standard.string(forKey: "serverURL") ?? ""
                }
            }
        }
    }

    private var isFormValid: Bool {
        !serverURL.trimmingCharacters(in: .whitespaces).isEmpty
            && !username.trimmingCharacters(in: .whitespaces).isEmpty
            && !password.isEmpty
    }

    private func performLogin() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        do {
            try await appState.login(
                serverURL: serverURL,
                username: username,
                password: password
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
