//
//  AppState.swift
//  livesnap
//
//  Shared UI state for the conversion flow.
//

import AVFoundation
import Combine
import CoreGraphics
import Foundation

final class AppState: ObservableObject {
    enum AspectRatio: Equatable {
        case original
        case lockScreen
    }

    @Published var selectedVideoURL: URL?
    @Published var selectedVideoAsset: AVAsset?
    @Published var selectedTimeRange: CMTimeRange?
    @Published var keyFrameTime: CMTime = .zero

    @Published var aspectRatio: AspectRatio = .original
    @Published var cropScale: CGFloat = 1.0
    @Published var cropOffset: CGSize = .zero
    @Published var previewSize: CGSize = CGSize(width: 375, height: 667)

    @Published var isProcessing = false
    @Published var processingProgress = 0.0
    @Published var processingStatus = ""
    @Published var processingError: String?

    @Published var exportedLivePhotoAssetID: String?
    @Published var exportedLivePhotoURL: URL?
    @Published var showExportSuccess = false

    @Published var isProUser = false

    func resetProcessingState() {
        isProcessing = false
        processingProgress = 0.0
        processingStatus = ""
        processingError = nil
    }

    func resetEditingState() {
        selectedTimeRange = nil
        keyFrameTime = .zero
        aspectRatio = .original
        cropScale = 1.0
        cropOffset = .zero
        previewSize = CGSize(width: 375, height: 667)
    }
}
