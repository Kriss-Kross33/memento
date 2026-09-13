package expo.modules.mementopdf

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class MementoPdfModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MementoPdf")

    Function("isSupported") {
      true
    }

    AsyncFunction("rasterize") { uri: String, maxPages: Int, width: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val parsed = Uri.parse(uri)
      val descriptor = openDescriptor(parsed)
        ?: throw Exception("Could not open PDF")

      descriptor.use { pfd ->
        val renderer = PdfRenderer(pfd)
        renderer.use { pdf ->
          if (pdf.pageCount <= 0) {
            throw Exception("PDF has no pages")
          }
          if (pdf.pageCount > maxPages) {
            throw Exception("too-many-pages")
          }
          val outputDir = File(context.cacheDir, "memento-pdf").apply { mkdirs() }
          val pages = mutableListOf<String>()
          val targetWidth = width.coerceAtLeast(320)
          for (index in 0 until pdf.pageCount) {
            pdf.openPage(index).use { page ->
              val scale = if (page.width > 0) targetWidth.toFloat() / page.width else 1f
              val bitmap = Bitmap.createBitmap(
                (page.width * scale).toInt().coerceAtLeast(1),
                (page.height * scale).toInt().coerceAtLeast(1),
                Bitmap.Config.ARGB_8888
              )
              bitmap.eraseColor(Color.WHITE)
              page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
              val file = File(outputDir, "page-$index-${System.currentTimeMillis()}.jpg")
              FileOutputStream(file).use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, 85, out)
              }
              bitmap.recycle()
              pages.add(Uri.fromFile(file).toString())
            }
          }
          if (pages.isEmpty()) {
            throw Exception("raster-failed")
          }
          pages
        }
      }
    }
  }

  private fun openDescriptor(uri: Uri): ParcelFileDescriptor? {
    val context = appContext.reactContext ?: return null
    return if (uri.scheme == "file" || uri.scheme == null) {
      val path = uri.path ?: return null
      ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
    } else {
      context.contentResolver.openFileDescriptor(uri, "r")
    }
  }
}
