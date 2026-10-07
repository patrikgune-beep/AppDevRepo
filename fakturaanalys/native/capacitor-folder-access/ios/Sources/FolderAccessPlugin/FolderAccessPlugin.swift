import Foundation
import UIKit
import UniformTypeIdentifiers
import Capacitor

/// Låter appen välja en mapp i Filer (iCloud Drive, "På min iPad" m.fl.) och komma ihåg den.
/// iOS ger bara bestående åtkomst via ett "security-scoped bookmark", som sparas per nyckel
/// (projekt-id) i UserDefaults. Filerna läses bara – inget i mappen ändras eller raderas.
@objc(FolderAccessPlugin)
public class FolderAccessPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "FolderAccessPlugin"
    public let jsName = "FolderAccess"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "forget", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportFile", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var pendingKey: String?
    private var exportCall: CAPPluginCall?
    private let maxFiles = 5000

    private func defaultsKey(_ key: String) -> String { "fakturaanalys.folder." + key }

    private func error(_ message: String) -> NSError {
        NSError(domain: "FolderAccess", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    // MARK: Välj mapp

    @objc func pickFolder(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("key saknas"); return }
        pendingCall = call
        pendingKey = key
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [UTType.folder])
            picker.delegate = self
            picker.allowsMultipleSelection = false
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let call = exportCall {
            exportCall = nil
            call.resolve(["saved": true])
            return
        }
        guard let call = pendingCall, let key = pendingKey, let url = urls.first else { return }
        pendingCall = nil
        let ok = url.startAccessingSecurityScopedResource()
        defer { if ok { url.stopAccessingSecurityScopedResource() } }
        do {
            let bookmark = try url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil)
            UserDefaults.standard.set(bookmark, forKey: defaultsKey(key))
            call.resolve(["name": url.lastPathComponent])
        } catch {
            call.reject("Kunde inte spara mappen: \(error.localizedDescription)")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if let call = exportCall {
            exportCall = nil
            call.reject("Avbrutet", "CANCELLED")
            return
        }
        pendingCall?.reject("Avbrutet", "CANCELLED")
        pendingCall = nil
    }

    // MARK: Spara en fil (säkerhetskopia) var användaren vill i Filer

    @objc func exportFile(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), let b64 = call.getString("data"),
              let data = Data(base64Encoded: b64) else { call.reject("name/data saknas"); return }
        let safeName = (name as NSString).lastPathComponent
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
        do { try data.write(to: tmp, options: .atomic) } catch { call.reject(error.localizedDescription); return }
        exportCall = call
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forExporting: [tmp], asCopy: true)
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    private func folderURL(_ key: String) throws -> URL {
        guard let data = UserDefaults.standard.data(forKey: defaultsKey(key)) else { throw error("Ingen mapp vald") }
        var stale = false
        let url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
        if stale, url.startAccessingSecurityScopedResource() {
            defer { url.stopAccessingSecurityScopedResource() }
            if let fresh = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
                UserDefaults.standard.set(fresh, forKey: defaultsKey(key))
            }
        }
        return url
    }

    // MARK: Lista filer

    @objc func listFiles(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else { call.reject("key saknas"); return }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let root = try self.folderURL(key)
                guard root.startAccessingSecurityScopedResource() else { throw self.error("Åtkomst till mappen nekades – välj mappen igen") }
                defer { root.stopAccessingSecurityScopedResource() }
                let rootPath = root.resolvingSymlinksInPath().path
                let keys: [URLResourceKey] = [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]
                var files: [[String: Any]] = []
                var coordError: NSError?
                // Koordinerad läsning så att iCloud-mappar listas korrekt
                NSFileCoordinator().coordinate(readingItemAt: root, options: [], error: &coordError) { url in
                    let enumerator = FileManager.default.enumerator(at: url, includingPropertiesForKeys: keys,
                                                                    options: [.skipsPackageDescendants])
                    while let item = enumerator?.nextObject() as? URL, files.count < self.maxFiles {
                        var name = item.lastPathComponent
                        var target = item
                        var notDownloaded = false
                        // Filer som ännu inte hämtats från iCloud syns som ".namn.pdf.icloud"
                        if name.hasPrefix(".") && name.hasSuffix(".icloud") {
                            name = String(name.dropFirst().dropLast(".icloud".count))
                            target = item.deletingLastPathComponent().appendingPathComponent(name)
                            notDownloaded = true
                            try? FileManager.default.startDownloadingUbiquitousItem(at: target)
                        } else if name.hasPrefix(".") {
                            continue
                        }
                        let values = try? item.resourceValues(forKeys: Set(keys))
                        if !notDownloaded && values?.isRegularFile != true { continue }
                        let fullPath = target.resolvingSymlinksInPath().path
                        guard fullPath.hasPrefix(rootPath + "/") else { continue }
                        let rel = String(fullPath.dropFirst(rootPath.count + 1))
                        files.append([
                            "path": rel,
                            "size": values?.fileSize ?? 0,
                            "modified": (values?.contentModificationDate?.timeIntervalSince1970 ?? 0) * 1000,
                            "notDownloaded": notDownloaded
                        ])
                    }
                }
                if let coordError = coordError { throw coordError }
                call.resolve(["name": root.lastPathComponent, "files": files])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    // MARK: Läs en fil (base64)

    @objc func readFile(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let path = call.getString("path") else { call.reject("key/path saknas"); return }
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let root = try self.folderURL(key)
                guard root.startAccessingSecurityScopedResource() else { throw self.error("Åtkomst till mappen nekades – välj mappen igen") }
                defer { root.stopAccessingSecurityScopedResource() }
                let rootPath = root.resolvingSymlinksInPath().path
                let file = root.appendingPathComponent(path).standardizedFileURL
                guard file.resolvingSymlinksInPath().path.hasPrefix(rootPath + "/") else { throw self.error("Ogiltig sökväg") }
                var data: Data?
                var readError: Error?
                var coordError: NSError?
                // Koordinatorn hämtar filen från iCloud vid behov
                NSFileCoordinator().coordinate(readingItemAt: file, options: [], error: &coordError) { url in
                    do { data = try Data(contentsOf: url) } catch { readError = error }
                }
                if let e = coordError ?? (readError as NSError?) { throw e }
                guard let bytes = data else { throw self.error("Kunde inte läsa filen") }
                call.resolve(["data": bytes.base64EncodedString()])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func forget(_ call: CAPPluginCall) {
        if let key = call.getString("key") { UserDefaults.standard.removeObject(forKey: defaultsKey(key)) }
        call.resolve()
    }
}
