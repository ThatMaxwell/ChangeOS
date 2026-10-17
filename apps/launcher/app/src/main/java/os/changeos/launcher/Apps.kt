package os.changeos.launcher

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RectF
import android.graphics.drawable.AdaptiveIconDrawable
import android.graphics.drawable.Drawable

data class App(val label: String, val component: ComponentName, val icon: Drawable)

object Apps {
    /** Home grid and dock: first installed match wins for each slot. */
    val GRID = listOf(
        listOf("com.android.camera2", "org.lineageos.aperture"),
        listOf("com.android.contacts"),
        listOf("org.mozilla.firefox"),
        listOf("com.aurora.store"),
        listOf("com.android.messaging", "com.google.android.apps.messaging"),
        listOf("com.termux"),
        listOf("com.android.documentsui"),
        listOf("com.android.settings"),
    )
    val DOCK = listOf(
        listOf("com.android.dialer"),
        listOf("com.android.messaging"),
        listOf("org.mozilla.firefox"),
    )

    fun all(ctx: Context): List<App> {
        val pm = ctx.packageManager
        val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(main, 0)
            .filter { it.activityInfo.packageName != ctx.packageName && it.activityInfo.packageName !in PlayGuard.BANNED }
            .map { it.toApp(ctx) }
            .sortedBy { it.label.lowercase() }
    }

    fun pick(all: List<App>, slots: List<List<String>>): List<App?> =
        slots.map { options -> options.firstNotNullOfOrNull { pkg -> all.firstOrNull { it.component.packageName == pkg } } }

    private fun ResolveInfo.toApp(ctx: Context): App {
        val pm = ctx.packageManager
        return App(loadLabel(pm).toString(), ComponentName(activityInfo.packageName, activityInfo.name), loadIcon(pm))
    }

    fun launch(ctx: Context, app: App) {
        ctx.startActivity(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            .setComponent(app.component).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED))
    }

    private val iconCache = HashMap<String, Bitmap>()

    /** ChangeOS monochrome icon: the app's themed (monochrome) layer tinted with the accent, else a grayscale icon. */
    fun monoIcon(app: App, size: Int, tint: Int): Bitmap {
        val key = "${app.component.flattenToShortString()}|$size|$tint"
        iconCache[key]?.let { return it }
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val d = app.icon
        val mono = (d as? AdaptiveIconDrawable)?.monochrome
        if (mono != null) {
            val inset = -size / 4  // monochrome layers are drawn at adaptive-icon scale
            mono.setBounds(inset, inset, size - inset, size - inset)
            mono.colorFilter = PorterDuffColorFilter(tint, PorterDuff.Mode.SRC_IN)
            mono.draw(c)
        } else {
            d.setBounds(0, 0, size, size)
            d.colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
            d.draw(c)
            d.colorFilter = null
        }
        iconCache[key] = bmp
        return bmp
    }

    fun clearCache() = iconCache.clear()

    fun roundRect(c: Canvas, r: RectF, radius: Float, color: Int, p: Paint) {
        p.color = color; p.style = Paint.Style.FILL; c.drawRoundRect(r, radius, radius, p)
    }
}
