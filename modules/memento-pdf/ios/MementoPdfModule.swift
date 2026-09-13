import ExpoModulesCore
import PDFKit
import UIKit

private final class PdfModuleException: Exception {
  private let message: String
  init(_ message: String) {
    self.message = message
    super.init()
  }
  override var reason: String { message }
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

public class MementoPdfModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MementoPdf")

    Function("isSupported") {
      true
    }

    AsyncFunction("rasterize") { (uri: String, maxPages: Int, width: Int) -> [String] in
      guard let url = fileURL(from: uri), let document = PDFDocument(url: url) else {
        throw PdfModuleException("Could not open PDF")
      }
      let count = document.pageCount
      if count <= 0 {
        throw PdfModuleException("raster-failed")
      }
      if count > maxPages {
        throw PdfModuleException("too-many-pages")
      }

      let targetWidth = max(width, 320)
      var output: [String] = []
      let directory = FileManager.default.temporaryDirectory.appendingPathComponent("memento-pdf", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

      for index in 0..<count {
        guard let page = document.page(at: index) else { continue }
        let bounds = page.bounds(for: .mediaBox)
        let scale = bounds.width > 0 ? CGFloat(targetWidth) / bounds.width : 1
        let size = CGSize(width: bounds.width * scale, height: bounds.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { context in
          UIColor.white.setFill()
          context.fill(CGRect(origin: .zero, size: size))
          context.cgContext.saveGState()
          context.cgContext.translateBy(x: 0, y: size.height)
          context.cgContext.scaleBy(x: scale, y: -scale)
          page.draw(with: .mediaBox, to: context.cgContext)
          context.cgContext.restoreGState()
        }
        let file = directory.appendingPathComponent("page-\(index)-\(UUID().uuidString).jpg")
        guard let data = image.jpegData(compressionQuality: 0.85) else { continue }
        try data.write(to: file)
        output.append(file.absoluteString)
      }

      if output.isEmpty {
        throw PdfModuleException("raster-failed")
      }
      return output
    }
  }
}
