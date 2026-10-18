package os.changeos.launcher

import android.content.Context
import android.graphics.Color
import android.provider.Settings
import android.util.Log
import org.json.JSONObject

/** ChangeOS look: a theme (Fog / Graphite / Loud / Pumpkin) plus one accent color the user picks. */
data class Look(val theme: String, val accent: Int) {
    val loud get() = theme == "loud"
    val graphite get() = theme == "graphite"
    /** Pumpkin Caramel: night-brown wall, caramel text, every app tile is a pumpkin. */
    val pumpkin get() = theme == "pumpkin"

    val wall get() = when { pumpkin -> 0xFF1C1009.toInt(); loud -> accent; graphite -> 0xFF1D1D20.toInt(); else -> 0xFFD9D9DE.toInt() }
    val card get() = when { pumpkin -> 0xFF2E1B0E.toInt(); graphite -> 0xFF2B2B2F.toInt(); loud -> Color.WHITE; else -> 0xFFF7F7F8.toInt() }
    val fg get() = when { pumpkin -> CARAMEL; graphite -> 0xFFF2F2F2.toInt(); loud -> onColor(accent); else -> Color.BLACK }
    val cardFg get() = when { pumpkin -> CARAMEL; graphite -> 0xFFF2F2F2.toInt(); else -> Color.BLACK }
    val sub get() = when { pumpkin -> 0xFFC79A6B.toInt(); graphite -> 0xFF9A9AA0.toInt(); loud -> (onColor(accent) and 0x00FFFFFF) or 0xB3000000.toInt(); else -> 0xFF5A5A60.toInt() }
    val dock get() = when { pumpkin -> 0xFF2E1B0E.toInt(); graphite -> 0xFF2B2B2F.toInt(); loud -> 0x47FFFFFF; else -> 0xFFC9C9CF.toInt() }
    val iconTint get() = if (graphite) 0xFFF2F2F2.toInt() else accent
    val lightBars get() = !graphite && !pumpkin && onColor(wall) == Color.BLACK

    companion object {
        val ACCENTS = intArrayOf(0xFF2F6BFF.toInt(), 0xFFFF2E88.toInt(), 0xFFFF6A00.toInt(), 0xFFB6F000.toInt(), 0xFF7A3CFF.toInt(), 0xFF111111.toInt())
        val THEMES = arrayOf("fog", "graphite", "loud", "pumpkin")
        val PUMPKIN = 0xFFFF7A1A.toInt()
        val CARAMEL = 0xFFFFE6C2.toInt()

        /** Edition builds (e.g. Pumpkin Caramel) ship /system/etc/changeos-edition naming their default theme. */
        private fun editionDefault(): Look {
            val ed = runCatching { java.io.File("/system/etc/changeos-edition").readText().trim() }.getOrNull()
            return if (ed == "pumpkin") Look("pumpkin", PUMPKIN) else Look("fog", ACCENTS[0])
        }

        fun onColor(c: Int): Int {
            val l = 0.299 * Color.red(c) + 0.587 * Color.green(c) + 0.114 * Color.blue(c)
            return if (l > 165) Color.BLACK else Color.WHITE
        }

        fun load(ctx: Context): Look {
            val p = ctx.getSharedPreferences("look", Context.MODE_PRIVATE)
            val d = editionDefault()
            return Look(p.getString("theme", d.theme)!!, p.getInt("accent", d.accent))
        }

        fun save(ctx: Context, look: Look) {
            ctx.getSharedPreferences("look", Context.MODE_PRIVATE).edit()
                .putString("theme", look.theme).putInt("accent", look.accent).apply()
            applySystemAccent(ctx, look)
        }

        /**
         * System-wide accent: feed the user's color to Android's own Material You engine
         * (SystemUI's ThemeOverlayController watches this secure setting), so Settings, quick settings
         * and every app pick it up. Needs WRITE_SECURE_SETTINGS (privileged, whitelisted).
         */
        fun applySystemAccent(ctx: Context, look: Look) {
            try {
                val hex = String.format("%06X", look.accent and 0xFFFFFF)
                val json = JSONObject()
                    .put("android.theme.customization.color_source", "preset")
                    .put("android.theme.customization.system_palette", hex)
                    .put("android.theme.customization.accent_color", hex)
                    .put("android.theme.customization.theme_style", if (look.loud || look.pumpkin) "VIBRANT" else "TONAL_SPOT")
                Settings.Secure.putString(ctx.contentResolver, "theme_customization_overlay_packages", json.toString())
            } catch (e: SecurityException) {
                Log.w("ChangeOS", "no WRITE_SECURE_SETTINGS, accent stays launcher-only", e)
            }
        }
    }
}
