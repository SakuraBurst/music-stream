import Foundation
import Security

/// Keys for Keychain items.
enum KeychainKey: String {
    case accessToken = "com.sonus.accessToken"
    case refreshToken = "com.sonus.refreshToken"
}

/// A helper for reading/writing/deleting generic password items in the Keychain.
final class KeychainHelper: Sendable {

    /// Save a string value to the Keychain. Overwrites if the key already exists.
    func save(key: KeychainKey, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        // Delete existing item first to avoid errSecDuplicateItem.
        delete(key: key)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]

        SecItemAdd(query as CFDictionary, nil)
    }

    /// Read a string value from the Keychain.
    func read(key: KeychainKey) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let string = String(data: data, encoding: .utf8) else {
            return nil
        }

        return string
    }

    /// Delete a value from the Keychain.
    @discardableResult
    func delete(key: KeychainKey) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
        ]

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    /// Delete all Sonus tokens from the Keychain.
    func deleteAll() {
        delete(key: .accessToken)
        delete(key: .refreshToken)
    }
}
