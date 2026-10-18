package os.changeos.launcher

import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import kotlin.math.cos
import kotlin.math.sin

/** The ChangeOS status glyph (same geometry as Logo.svg): battery ring, signal dots, Wi-Fi bullseye. */
object RingGlyph {
    enum class Wifi { CONNECTED, NO_INTERNET, OFF, MOBILE }

    private const val CX = 50f; private const val CY = 50f; private const val R = 36f; private const val STROKE = 7f
    private const val GAP_AT = -45f; private const val GAP_HALF = 37f
    private const val A0 = GAP_AT + GAP_HALF; private const val A1 = GAP_AT + 360f - GAP_HALF
    private val DOTS = floatArrayOf(36.5f, 45.5f, 54.5f, 63.5f)
    private const val DOT_R = 3.6f; private const val BULL_R = 14f; private const val HOLE_R = 6.5f
    private const val LOW = 0xFFFF3B30.toInt()

    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val box = RectF(CX - R, CY - R, CX + R, CY + R)

    /** Draws the glyph into [size] x [size] px at (x, y). [bg] is used for the bullseye cut-out. */
    fun draw(c: Canvas, x: Float, y: Float, size: Float, battery: Int, signal: Int, wifi: Wifi, fg: Int, mute: Int, bg: Int) {
        c.save()
        c.translate(x, y)
        c.scale(size / 100f, size / 100f)
        val split = A1 - (A1 - A0) * (battery.coerceIn(0, 100) / 100f)
        p.style = Paint.Style.STROKE; p.strokeWidth = STROKE; p.strokeCap = Paint.Cap.ROUND
        if (split - A0 > 0.5f) { p.color = mute; c.drawArc(box, A0, split - A0, false, p) }
        if (A1 - split > 0.5f) { p.color = if (battery <= 15) LOW else fg; c.drawArc(box, split, A1 - split, false, p) }
        p.style = Paint.Style.FILL
        DOTS.forEachIndexed { i, dx -> p.color = if (i < signal) fg else mute; c.drawCircle(dx, CY, DOT_R, p) }
        val bx = CX + R * cos(Math.toRadians(GAP_AT.toDouble())).toFloat()
        val by = CY + R * sin(Math.toRadians(GAP_AT.toDouble())).toFloat()
        p.color = fg; c.drawCircle(bx, by, BULL_R, p)
        when (wifi) {
            Wifi.CONNECTED -> { p.color = bg; c.drawCircle(bx, by, HOLE_R, p) }
            Wifi.NO_INTERNET -> { p.color = mute; c.drawCircle(bx, by, HOLE_R, p) }
            Wifi.OFF -> { p.style = Paint.Style.STROKE; p.strokeWidth = 2.4f; p.color = bg; c.drawCircle(bx, by, HOLE_R, p) }
            Wifi.MOBILE -> {
                p.style = Paint.Style.STROKE; p.strokeWidth = 1.6f; p.color = bg; c.drawCircle(bx, by, HOLE_R, p)
                p.style = Paint.Style.FILL
                c.drawPath(Path().apply { addArc(RectF(bx - HOLE_R, by - HOLE_R, bx + HOLE_R, by + HOLE_R), -135f, 180f); close() }, p)
            }
        }
        c.restore()
    }
}
