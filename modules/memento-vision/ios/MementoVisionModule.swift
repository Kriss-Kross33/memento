import ExpoModulesCore
import UIKit
import Vision

private func cgImageOrientation(from uiOrientation: UIImage.Orientation) -> CGImagePropertyOrientation {
  switch uiOrientation {
  case .up: return .up
  case .down: return .down
  case .left: return .left
  case .right: return .right
  case .upMirrored: return .upMirrored
  case .downMirrored: return .downMirrored
  case .leftMirrored: return .leftMirrored
  case .rightMirrored: return .rightMirrored
  @unknown default: return .up
  }
}

private func fileURL(from uri: String) -> URL? {
  if uri.hasPrefix("file://"), let url = URL(string: uri), url.isFileURL {
    return url
  }
  if uri.hasPrefix("/") {
    return URL(fileURLWithPath: uri)
  }
  return URL(string: uri)
}

/// Vision boxes are normalized [0, 1] with origin at the bottom-left.
/// Memento uses pixel boxes with origin at the top-left.
private func denormalizeVisionRect(_ rect: CGRect, imageSize: CGSize) -> [String: CGFloat] {
  let x = rect.origin.x * imageSize.width
  let width = rect.size.width * imageSize.width
  let height = rect.size.height * imageSize.height
  let y = (1.0 - rect.origin.y - rect.size.height) * imageSize.height
  return ["x": x, "y": y, "width": width, "height": height]
}

private func unionRects(_ rects: [CGRect]) -> CGRect? {
  guard var result = rects.first else { return nil }
  for next in rects.dropFirst() {
    result = result.union(next)
  }
  return result
}

public class MementoVisionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MementoVision")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.0, *) {
        return true
      }
      return false
    }

    AsyncFunction("recognizeText") { (uri: String, options: [String: Any]?, promise: Promise) in
      if #unavailable(iOS 16.0) {
        promise.reject("VISION_UNSUPPORTED", "Apple Vision text recognition requires iOS 16 or later")
        return
      }

      guard let url = fileURL(from: uri) else {
        promise.reject("INVALID_URI", "Invalid local image URI")
        return
      }

      guard let image = UIImage(contentsOfFile: url.path), let cgImage = image.cgImage else {
        promise.reject("IMAGE_LOAD_FAILED", "Failed to load image from the local file")
        return
      }

      let imageSize = CGSize(width: cgImage.width, height: cgImage.height)
      #if DEBUG
      NSLog("[ocr][vision] image loaded %dx%d", Int(imageSize.width), Int(imageSize.height))
      #endif

      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          promise.reject("RECOGNITION_FAILED", error.localizedDescription)
          return
        }

        let observations = ((request.results as? [VNRecognizedTextObservation]) ?? []).sorted { a, b in
          if a.boundingBox.minY != b.boundingBox.minY {
            return a.boundingBox.minY > b.boundingBox.minY
          }
          return a.boundingBox.minX < b.boundingBox.minX
        }

        var lines: [[String: Any]] = []
        var lineRects: [CGRect] = []
        var fullTextParts: [String] = []

        for observation in observations {
          let recognized = observation.topCandidates(4)
          guard let top = recognized.first else { continue }

          let lineText = top.string
          fullTextParts.append(lineText)
          lineRects.append(observation.boundingBox)

          var elements: [[String: Any]] = []
          let words = lineText.split(whereSeparator: { $0.isWhitespace }).map(String.init)
          var searchStart = lineText.startIndex
          for word in words {
            guard let range = lineText.range(of: word, range: searchStart..<lineText.endIndex) else { continue }
            searchStart = range.upperBound
            var element: [String: Any] = [
              "text": word,
              "confidence": top.confidence
            ]
            if let wordBox = try? top.boundingBox(for: range) {
              element["boundingBox"] = denormalizeVisionRect(wordBox.boundingBox, imageSize: imageSize)
            } else {
              element["boundingBox"] = denormalizeVisionRect(observation.boundingBox, imageSize: imageSize)
            }
            elements.append(element)
          }

          lines.append([
            "text": lineText,
            "boundingBox": denormalizeVisionRect(observation.boundingBox, imageSize: imageSize),
            "confidence": top.confidence,
            "candidates": recognized.map { ["text": $0.string, "confidence": $0.confidence] },
            "elements": elements
          ])
        }

        let fullText = fullTextParts.joined(separator: "\n")
        let blockRect = unionRects(lineRects) ?? .zero
        #if DEBUG
        NSLog("[ocr][vision] recognition complete lines=%d", lines.count)
        #endif

        promise.resolve([
          "text": fullText,
          "width": imageSize.width,
          "height": imageSize.height,
          "coordinateSpace": "pixels",
          "blocks": [[
            "text": fullText,
            "boundingBox": denormalizeVisionRect(blockRect, imageSize: imageSize),
            "lines": lines
          ]]
        ])
      }

      let level = (options?["recognitionLevel"] as? String) ?? "accurate"
      request.recognitionLevel = level == "fast" ? .fast : .accurate
      request.usesLanguageCorrection = (options?["usesLanguageCorrection"] as? Bool) ?? true
      if let languages = options?["recognitionLanguages"] as? [String], !languages.isEmpty {
        request.recognitionLanguages = languages
      } else {
        request.recognitionLanguages = ["en-US"]
      }
      if let minimumTextHeight = options?["minimumTextHeight"] as? Double {
        request.minimumTextHeight = Float(minimumTextHeight)
      }

      let handler = VNImageRequestHandler(
        cgImage: cgImage,
        orientation: cgImageOrientation(from: image.imageOrientation),
        options: [:]
      )

      do {
        try handler.perform([request])
      } catch {
        promise.reject("RECOGNITION_FAILED", error.localizedDescription)
      }
    }
  }
}
