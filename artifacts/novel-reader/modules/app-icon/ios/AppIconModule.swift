import ExpoModulesCore
import UIKit

public class AppIconModule: Module {
  private let classicIconName = "classic"

  public func definition() -> ModuleDefinition {
    Name("AppIcon")

    AsyncFunction("setAppIcon") { (iconId: String?) -> Bool in
      let resolved = (iconId?.isEmpty == false) ? (iconId ?? self.classicIconName) : self.classicIconName
      let alternateName: String? = resolved == self.classicIconName ? nil : resolved

      return try await withCheckedThrowingContinuation { continuation in
        DispatchQueue.main.async {
          guard UIApplication.shared.supportsAlternateIcons else {
            continuation.resume(returning: false)
            return
          }

          UIApplication.shared.setAlternateIconName(alternateName) { error in
            if let error {
              continuation.resume(throwing: error)
              return
            }
            continuation.resume(returning: resolved != self.classicIconName)
          }
        }
      }
    }

    Function("getAppIcon") { () -> String in
      let current = UIApplication.shared.alternateIconName
      return (current?.isEmpty == false) ? (current ?? self.classicIconName) : self.classicIconName
    }
  }
}
