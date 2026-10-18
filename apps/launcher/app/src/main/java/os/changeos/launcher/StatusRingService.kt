package os.changeos.launcher

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.res.Configuration
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.PixelFormat
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.provider.Settings
import android.telephony.SignalStrength
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent

/**
 * The ChangeOS ring status icon. SystemUI can't be rebuilt on a GSI, so ChangeOS hides the stock
 * battery / Wi-Fi / signal icons (icon_blacklist) and draws its own ring in their place, in an
 * accessibility overlay: the only window type an app may put above the status bar.
 * The stock icons come back automatically whenever this service isn't running.
 */
class StatusRingService : AccessibilityService() {
    private var view: RingView? = null
    private var battery = 100
    private var signal = 0
    private var wifi = RingGlyph.Wifi.OFF
    private var foreground: String? = null

    private val batteryReceiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
            if (level >= 0) { battery = level * 100 / scale.coerceAtLeast(1); view?.invalidate() }
        }
    }
    private val netCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onCapabilitiesChanged(n: Network, caps: NetworkCapabilities) {
            wifi = when {
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ->
                    if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) RingGlyph.Wifi.CONNECTED else RingGlyph.Wifi.NO_INTERNET
                caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> RingGlyph.Wifi.MOBILE
                else -> RingGlyph.Wifi.OFF
            }
            view?.post { view?.invalidate() }
        }
        override fun onLost(n: Network) { wifi = RingGlyph.Wifi.OFF; view?.post { view?.invalidate() } }
    }
    private var signalCallback: TelephonyCallback? = null

    override fun onServiceConnected() {
        instance = this
        val wm = getSystemService(WindowManager::class.java)
        val dp = resources.displayMetrics.density
        val sbId = resources.getIdentifier("status_bar_height", "dimen", "android")
        val barH = if (sbId > 0) resources.getDimensionPixelSize(sbId) else (24 * dp).toInt()
        val size = (18 * dp).toInt()
        val v = RingView(this)
        val lp = WindowManager.LayoutParams(
            size + (8 * dp).toInt(), barH,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.END
            x = (10 * dp).toInt(); y = 0
            layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            title = "ChangeOS status ring"
        }
        try { wm.addView(v, lp); view = v } catch (e: Exception) { Log.e(TAG, "can't add ring overlay", e); return }

        registerReceiver(batteryReceiver, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        try {
            getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(netCallback)
            if (!getSystemService(WifiManager::class.java).isWifiEnabled) wifi = RingGlyph.Wifi.OFF
        } catch (e: SecurityException) { Log.w(TAG, "no network updates", e) }
        try {
            val tm = getSystemService(TelephonyManager::class.java)
            signal = tm.signalStrength?.level ?: 0
            val cb = object : TelephonyCallback(), TelephonyCallback.SignalStrengthsListener {
                override fun onSignalStrengthsChanged(s: SignalStrength) { signal = s.level; view?.post { view?.invalidate() } }
            }
            tm.registerTelephonyCallback(mainExecutor, cb)
            signalCallback = cb
        } catch (e: Exception) { Log.w(TAG, "no signal updates", e) }

        hideStockIcons(this, true)
    }

    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        if (e.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val pkg = e.packageName?.toString() ?: return
            if (pkg != foreground) { foreground = pkg; view?.invalidate() }
        }
    }

    override fun onInterrupt() {}

    override fun onUnbind(intent: Intent?): Boolean { teardown(); return super.onUnbind(intent) }
    override fun onDestroy() { teardown(); super.onDestroy() }

    private fun teardown() {
        if (instance == null) return
        instance = null
        hideStockIcons(this, false)  // give the user their stock icons back
        try { unregisterReceiver(batteryReceiver) } catch (_: Exception) {}
        try { getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(netCallback) } catch (_: Exception) {}
        signalCallback?.let { try { getSystemService(TelephonyManager::class.java).unregisterTelephonyCallback(it) } catch (_: Exception) {} }
        view?.let { try { getSystemService(WindowManager::class.java).removeView(it) } catch (_: Exception) {} }
        view = null
    }

    /** Light or dark glyph: follow the ChangeOS look on the home screen, night mode elsewhere. */
    private fun darkGlyph(): Boolean {
        if (foreground == packageName || foreground == null) {
            // before first unlock the ChangeOS look (credential storage) isn't readable yet
            return try { Look.load(this).lightBars } catch (_: IllegalStateException) { true }
        }
        val night = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        return !night
    }

    fun refresh() { view?.invalidate() }

    inner class RingView(ctx: Context) : View(ctx) {
        override fun onDraw(c: Canvas) {
            val dark = darkGlyph()
            val fg = if (dark) Color.BLACK else Color.WHITE
            val mute = if (dark) 0x55000000 else 0x66FFFFFF
            val bg = if (dark) 0xFFF2F2F2.toInt() else 0xFF111111.toInt()
            val s = minOf(width, height).toFloat() * 0.78f
            RingGlyph.draw(c, (width - s) / 2f, (height - s) / 2f, s, battery, signal, wifi, fg, mute, bg)
        }
    }

    companion object {
        private const val TAG = "ChangeOS"
        @Volatile var instance: StatusRingService? = null
        private val HIDDEN = listOf("battery", "wifi", "mobile")

        fun component(ctx: Context) = ComponentName(ctx, StatusRingService::class.java).flattenToString()

        /** Turns the ring on at first boot. Needs WRITE_SECURE_SETTINGS (privileged, whitelisted). */
        fun ensureEnabled(ctx: Context) {
            try {
                val cr = ctx.contentResolver
                val me = component(ctx)
                val current = Settings.Secure.getString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES).orEmpty()
                if (me !in current.split(':')) {
                    Settings.Secure.putString(cr, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, listOf(current, me).filter { it.isNotBlank() }.joinToString(":"))
                }
                Settings.Secure.putInt(cr, Settings.Secure.ACCESSIBILITY_ENABLED, 1)
            } catch (e: SecurityException) { Log.w(TAG, "can't enable the status ring", e) }
        }

        fun hideStockIcons(ctx: Context, hide: Boolean) {
            try {
                val cr = ctx.contentResolver
                val list = Settings.Secure.getString(cr, "icon_blacklist").orEmpty().split(',').filter { it.isNotBlank() }.toMutableSet()
                if (hide) list.addAll(HIDDEN) else list.removeAll(HIDDEN.toSet())
                Settings.Secure.putString(cr, "icon_blacklist", list.joinToString(","))
            } catch (e: SecurityException) { Log.w(TAG, "can't change icon_blacklist", e) }
        }
    }
}
