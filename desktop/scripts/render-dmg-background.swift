import AppKit

let fileManager = FileManager.default
let repoRoot = URL(fileURLWithPath: fileManager.currentDirectoryPath, isDirectory: true)
let outputPath = CommandLine.arguments.dropFirst().first ?? "desktop/build/dmg-background.png"
let outputURL = URL(fileURLWithPath: outputPath, relativeTo: repoRoot).standardizedFileURL
let iconURL = repoRoot.appendingPathComponent("desktop/src-tauri/icons/128x128@2x.png")

let canvasSize = NSSize(width: 660, height: 400)
guard let bitmap = NSBitmapImageRep(
  bitmapDataPlanes: nil,
  pixelsWide: Int(canvasSize.width),
  pixelsHigh: Int(canvasSize.height),
  bitsPerSample: 8,
  samplesPerPixel: 4,
  hasAlpha: true,
  isPlanar: false,
  colorSpaceName: .deviceRGB,
  bytesPerRow: 0,
  bitsPerPixel: 0
) else {
  fputs("Failed to create DMG background bitmap.\n", stderr)
  exit(1)
}
bitmap.size = canvasSize

func color(_ hex: UInt32, alpha: CGFloat = 1) -> NSColor {
  let red = CGFloat((hex >> 16) & 0xff) / 255
  let green = CGFloat((hex >> 8) & 0xff) / 255
  let blue = CGFloat(hex & 0xff) / 255
  return NSColor(red: red, green: green, blue: blue, alpha: alpha)
}

func drawText(_ text: String, in rect: NSRect, size: CGFloat, weight: NSFont.Weight, color: NSColor, alignment: NSTextAlignment = .center) {
  let paragraph = NSMutableParagraphStyle()
  paragraph.alignment = alignment
  paragraph.lineBreakMode = .byWordWrapping
  let attrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: size, weight: weight),
    .foregroundColor: color,
    .paragraphStyle: paragraph,
  ]
  text.draw(in: rect, withAttributes: attrs)
}

func drawRoundedRect(_ rect: NSRect, radius: CGFloat, fill: NSColor, stroke: NSColor? = nil, lineWidth: CGFloat = 1) {
  let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
  fill.setFill()
  path.fill()
  if let stroke {
    stroke.setStroke()
    path.lineWidth = lineWidth
    path.stroke()
  }
}

func drawArrow(from start: NSPoint, to end: NSPoint) {
  let path = NSBezierPath()
  path.lineWidth = 3
  path.lineCapStyle = .round
  path.lineJoinStyle = .round
  path.move(to: start)
  path.curve(to: end, controlPoint1: NSPoint(x: start.x + 70, y: start.y + 18), controlPoint2: NSPoint(x: end.x - 70, y: end.y + 18))
  color(0x246bfe, alpha: 0.66).setStroke()
  path.stroke()

  let arrow = NSBezierPath()
  arrow.move(to: NSPoint(x: end.x - 15, y: end.y + 13))
  arrow.line(to: end)
  arrow.line(to: NSPoint(x: end.x - 17, y: end.y - 9))
  arrow.lineWidth = 3
  arrow.lineCapStyle = .round
  arrow.lineJoinStyle = .round
  color(0x246bfe, alpha: 0.66).setStroke()
  arrow.stroke()
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)

let bounds = NSRect(origin: .zero, size: canvasSize)
let backgroundGradient = NSGradient(colors: [
  color(0xf7fbff),
  color(0xeaf1fb),
  color(0xf4f8fc),
])!
backgroundGradient.draw(in: bounds, angle: 90)

drawRoundedRect(
  NSRect(x: 26, y: 24, width: 608, height: 352),
  radius: 28,
  fill: color(0xffffff, alpha: 0.58),
  stroke: color(0x9fb5d6, alpha: 0.36),
  lineWidth: 1
)

let brandPath = NSBezierPath()
brandPath.move(to: NSPoint(x: 70, y: 310))
brandPath.curve(to: NSPoint(x: 248, y: 338), controlPoint1: NSPoint(x: 124, y: 366), controlPoint2: NSPoint(x: 208, y: 362))
brandPath.curve(to: NSPoint(x: 396, y: 328), controlPoint1: NSPoint(x: 300, y: 306), controlPoint2: NSPoint(x: 354, y: 298))
brandPath.curve(to: NSPoint(x: 574, y: 306), controlPoint1: NSPoint(x: 452, y: 366), controlPoint2: NSPoint(x: 520, y: 358))
brandPath.lineWidth = 18
brandPath.lineCapStyle = .round
color(0x246bfe, alpha: 0.10).setStroke()
brandPath.stroke()

drawText("Gaster Code", in: NSRect(x: 0, y: 312, width: 660, height: 34), size: 25, weight: .semibold, color: color(0x182033))
drawText("Drag the app into Applications", in: NSRect(x: 0, y: 286, width: 660, height: 24), size: 13, weight: .regular, color: color(0x65738a))

let appWell = NSRect(x: 82, y: 126, width: 152, height: 152)
let applicationsWell = NSRect(x: 426, y: 126, width: 152, height: 152)
drawRoundedRect(appWell, radius: 34, fill: color(0xffffff, alpha: 0.78), stroke: color(0x246bfe, alpha: 0.24), lineWidth: 1.2)
drawRoundedRect(applicationsWell, radius: 34, fill: color(0xffffff, alpha: 0.78), stroke: color(0x246bfe, alpha: 0.24), lineWidth: 1.2)

if let appIcon = NSImage(contentsOf: iconURL) {
  appIcon.draw(in: NSRect(x: 112, y: 157, width: 92, height: 92), from: .zero, operation: .sourceOver, fraction: 1)
}

let applicationsIcon = NSWorkspace.shared.icon(forFile: "/Applications")
applicationsIcon.draw(in: NSRect(x: 456, y: 157, width: 92, height: 92), from: .zero, operation: .sourceOver, fraction: 1)

drawArrow(from: NSPoint(x: 246, y: 202), to: NSPoint(x: 414, y: 202))

drawText("Gaster Code.app", in: NSRect(x: 62, y: 93, width: 192, height: 22), size: 13, weight: .medium, color: color(0x263041))
drawText("Applications", in: NSRect(x: 406, y: 93, width: 192, height: 22), size: 13, weight: .medium, color: color(0x263041))
drawText("Clean install. Local projects and account state stay on this Mac.", in: NSRect(x: 70, y: 54, width: 520, height: 20), size: 11, weight: .regular, color: color(0x728197))

NSGraphicsContext.restoreGraphicsState()

guard let png = bitmap.representation(using: .png, properties: [:]) else {
  fputs("Failed to render DMG background PNG.\n", stderr)
  exit(1)
}

try fileManager.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
try png.write(to: outputURL)
print("Rendered \(outputURL.path)")
