import AVFoundation
import AppKit
let files = CommandLine.arguments.dropFirst(2).map { $0 }
let cols = 5, w = 256, h = 160
let rows = (files.count + cols - 1) / cols
let out = NSImage(size: NSSize(width: cols * w, height: rows * h))
out.lockFocus()
for (i, f) in files.enumerated() {
  let a = AVURLAsset(url: URL(fileURLWithPath: f))
  let g = AVAssetImageGenerator(asset: a)
  let t = CMTimeMultiplyByFloat64(a.duration, multiplier: 0.6)
  let x = (i % cols) * w, y = (rows - 1 - i / cols) * h
  if let cg = try? g.copyCGImage(at: t, actualTime: nil) { NSImage(cgImage: cg, size: .zero).draw(in: NSRect(x: x, y: y, width: w, height: h)) }
  (f.replacingOccurrences(of: ".mp4", with: "") as NSString).draw(at: NSPoint(x: x + 4, y: y + 4), withAttributes: [.foregroundColor: NSColor.white, .backgroundColor: NSColor.black, .font: NSFont.systemFont(ofSize: 12)])
}
out.unlockFocus()
try! NSBitmapImageRep(data: out.tiffRepresentation!)!.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
