package expo.modules.appicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AppIconModule : Module() {
  private val supportedIcons = listOf("classic", "black", "white", "orange", "cream", "midnight")

  private fun component(context: Context, className: String): ComponentName {
    return ComponentName(context, "${context.packageName}.$className")
  }

  private fun setEnabled(context: Context, className: String, enabled: Boolean) {
    context.packageManager.setComponentEnabledSetting(
      component(context, className),
      if (enabled) {
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED
      } else {
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED
      },
      PackageManager.DONT_KILL_APP,
    )
  }

  override fun definition() = ModuleDefinition {
    Name("AppIcon")

    AsyncFunction("setAppIcon") { iconId: String? ->
      val context = requireNotNull(appContext.reactContext) { "React context is unavailable." }
      val resolved = if (iconId.isNullOrBlank()) "classic" else iconId
      if (resolved !in supportedIcons) {
        throw IllegalArgumentException("Unknown app icon: $iconId")
      }

      // Classic restores the primary launcher activity. Alternates swap to an
      // activity-alias that targets the same MainActivity.
      setEnabled(context, "MainActivity", resolved == "classic")
      supportedIcons.forEach { id ->
        if (id == "classic") return@forEach
        setEnabled(context, "MainActivity${id.replaceFirstChar { it.uppercase() }}Icon", id == resolved)
      }

      context
        .getSharedPreferences("prime-app-icon", Context.MODE_PRIVATE)
        .edit()
        .putString("iconId", resolved)
        .apply()

      true
    }

    Function("getAppIcon") {
      val context = requireNotNull(appContext.reactContext) { "React context is unavailable." }
      context
        .getSharedPreferences("prime-app-icon", Context.MODE_PRIVATE)
        .getString("iconId", "classic")
    }
  }
}
