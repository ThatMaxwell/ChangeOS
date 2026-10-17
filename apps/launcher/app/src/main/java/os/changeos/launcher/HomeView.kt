package os.changeos.launcher

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import java.util.Calendar
import java.util.Locale
import kotlin.math.abs

/** The Fog home screen: date card, a 4x2 grid of monochrome icons, and a dock. Drawn directly for speed. */
@SuppressLint("ViewConstructor")
class HomeView(ctx: Context, private val listener: Listener) : View(ctx) {
    interface Listener {
        fun onOpen(app: App)
        fun onOpenDrawer()
        fun onCustomize()
        fun onOpenNotifications()
    }

    var look: Look = Look.load(ctx)
        set(v) { field = v; Apps.clearCache(); invalidate() }
    var grid: List<App?> = emptyList()
        set(v) { field = v; invalidate() }
    var dock: List<App?> = emptyList()
        set(v) { field = v; invalidate() }

    private val dp = resources.displayMetrics.density
    private val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val bold = Typeface.create("sans-serif", Typeface.BOLD)
    private val regular = Typeface.create("sans-serif", Typeface.NORMAL)
    private var topInset = 0f
    private var bottomInset = 0f
    private val hits = ArrayList<Pair<RectF, () -> Unit>>()

    override fun onApplyWindowInsets(insets: WindowInsets): WindowInsets {
        val bars = insets.getInsets(WindowInsets.Type.systemBars())
        topInset = bars.top.toFloat(); bottomInset = bars.bottom.toFloat()
        invalidate()
        return insets
    }

    override fun onDraw(c: Canvas) {
        hits.clear()
        val w = width.toFloat(); val h = height.toFloat()
        val pad = 18 * dp
        c.drawColor(look.wall)

        // ---- date card ----
        val card = RectF(pad, topInset + 12 * dp, w - pad, topInset + 12 * dp + 150 * dp)
        Apps.roundRect(c, card, 30 * dp, look.card, p)
        val cal = Calendar.getInstance()
        p.color = look.cardFg; p.typeface = bold
        p.textSize = 34 * dp
        c.drawText(cal.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.SHORT, Locale.ENGLISH)!!.uppercase(), card.left + 22 * dp, card.top + 58 * dp, p)
        p.textSize = 64 * dp
        c.drawText(cal.get(Calendar.DAY_OF_MONTH).toString(), card.left + 18 * dp, card.top + 128 * dp, p)
        drawMonth(c, cal, RectF(card.left + 140 * dp, card.top + 20 * dp, card.right - 18 * dp, card.bottom - 16 * dp))
        hits += card to { listener.onOpenNotifications() }

        // ---- app grid ----
        val cols = 4
        val cell = (w - pad * 2) / cols
        val tile = minOf(cell - 18 * dp, 72 * dp)
        val gridTop = card.bottom + 34 * dp
        grid.forEachIndexed { i, app ->
            if (app == null) return@forEachIndexed
            val cx = pad + cell * (i % cols) + cell / 2
            val top = gridTop + (i / cols) * (tile + 44 * dp)
            drawTile(c, app, cx, top, tile, label = true)
        }

        // ---- dock ----
        val dockH = 92 * dp
        val dockR = RectF(pad - 4 * dp, h - bottomInset - dockH - 14 * dp, w - pad + 4 * dp, h - bottomInset - 14 * dp)
        Apps.roundRect(c, dockR, 34 * dp, look.dock, p)
        val slots = dock.size + 1
        val dcell = dockR.width() / slots
        val dtile = minOf(dcell - 20 * dp, 64 * dp)
        dock.forEachIndexed { i, app ->
            if (app != null) drawTile(c, app, dockR.left + dcell * i + dcell / 2, dockR.centerY() - dtile / 2, dtile, label = false)
        }
        // app-drawer button: three dots
        val bx = dockR.left + dcell * dock.size + dcell / 2
        val br = RectF(bx - dtile / 2, dockR.centerY() - dtile / 2, bx + dtile / 2, dockR.centerY() + dtile / 2)
        Apps.roundRect(c, br, 20 * dp, look.card, p)
        p.color = look.iconTint
        for (k in -1..1) c.drawCircle(bx + k * 9 * dp, br.centerY(), 3.2f * dp, p)
        hits += br to { listener.onOpenDrawer() }

        // swipe hint
        p.color = look.sub; p.typeface = regular; p.textSize = 12 * dp; p.textAlign = Paint.Align.CENTER
        c.drawText("Swipe up for all apps. Hold for themes.", w / 2, dockR.top - 14 * dp, p)
        p.textAlign = Paint.Align.LEFT
    }

    private fun drawTile(c: Canvas, app: App, cx: Float, top: Float, size: Float, label: Boolean) {
        val r = RectF(cx - size / 2, top, cx + size / 2, top + size)
        Apps.roundRect(c, r, size * 0.3f, look.card, p)
        val iconPx = (size * 0.62f).toInt()
        val bmp = Apps.monoIcon(app, iconPx, look.iconTint)
        c.drawBitmap(bmp, cx - iconPx / 2f, top + (size - iconPx) / 2f, p)
        if (label) {
            p.color = look.fg; p.typeface = regular; p.textSize = 12.5f * dp; p.textAlign = Paint.Align.CENTER
            var t = app.label
            while (p.measureText(t) > size + 20 * dp && t.length > 3) t = t.dropLast(2) + "…"
            c.drawText(t, cx, r.bottom + 18 * dp, p)
            p.textAlign = Paint.Align.LEFT
        }
        hits += RectF(r.left, r.top, r.right, r.bottom + (if (label) 22 * dp else 0f)) to { listener.onOpen(app) }
    }

    private fun drawMonth(c: Canvas, today: Calendar, box: RectF) {
        val cal = today.clone() as Calendar
        cal.set(Calendar.DAY_OF_MONTH, 1)
        val first = cal.get(Calendar.DAY_OF_WEEK) - 1
        val days = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val cw = box.width() / 7; val ch = box.height() / 7
        p.textAlign = Paint.Align.CENTER; p.textSize = minOf(ch * 0.62f, 12 * dp)
        "SMTWTFS".forEachIndexed { i, d ->
            p.color = look.cardFg; p.typeface = bold
            c.drawText(d.toString(), box.left + cw * i + cw / 2, box.top + ch * 0.8f, p)
        }
        p.typeface = regular
        for (d in 1..days) {
            val cell = first + d - 1
            val x = box.left + cw * (cell % 7) + cw / 2
            val y = box.top + ch * (cell / 7 + 1) + ch * 0.8f
            if (d == today.get(Calendar.DAY_OF_MONTH)) {
                val rr = RectF(x - cw * 0.46f, y - ch * 0.78f, x + cw * 0.46f, y + ch * 0.24f)
                Apps.roundRect(c, rr, 6 * dp, if (look.loud) look.accent else look.cardFg, p)
                p.color = if (look.loud) Look.onColor(look.accent) else look.card
            } else p.color = (look.cardFg and 0x00FFFFFF) or 0xB3000000.toInt()
            c.drawText(d.toString(), x, y, p)
        }
        p.textAlign = Paint.Align.LEFT
    }

    private val gestures = GestureDetector(ctx, object : GestureDetector.SimpleOnGestureListener() {
        override fun onDown(e: MotionEvent) = true
        override fun onSingleTapUp(e: MotionEvent): Boolean {
            hits.lastOrNull { it.first.contains(e.x, e.y) }?.second?.invoke()
            return true
        }
        override fun onLongPress(e: MotionEvent) {
            if (hits.none { it.first.contains(e.x, e.y) }) listener.onCustomize()
        }
        override fun onFling(e1: MotionEvent?, e2: MotionEvent, vx: Float, vy: Float): Boolean {
            if (abs(vy) > abs(vx) && vy < -600) { listener.onOpenDrawer(); return true }
            if (abs(vy) > abs(vx) && vy > 600) { listener.onOpenNotifications(); return true }
            return false
        }
    })

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent) = gestures.onTouchEvent(e)
}
