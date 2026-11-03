//
//  HistoryStore.swift
//  livesnap
//
//  Compatibility facade used by tests and older call sites.
//

import Foundation

@MainActor
final class HistoryStore {
    static let shared = HistoryStore()

    private init() {}

    func save(assetID: String) {
        StorageManager.shared.addHistoryAssetID(assetID)
    }
}
