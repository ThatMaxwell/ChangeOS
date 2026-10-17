package os.changeos.launcher

import android.app.Activity
import android.app.AlertDialog
import android.app.WallpaperManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsetsController
import android.widget.BaseAdapter
import android.widget.FrameLayout
import android.widget.GridView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

class HomeActivity : Activity(), HomeView.Listener {
    private lateinit var root: FrameLayout
    private lateinit var home: HomeView
    private var drawer: View? = null
    private var apps: List<App> = emptyList()
    private val dp by lazy { resources.displayMetrics.density }

    private val packageChanges = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) { reloadApps() }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        home = HomeView(this, this)
        root.addView(home, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)
        window.setDecorFitsSystemWindows(false)

        val prefs = getSharedPreferences("look", MODE_PRIVATE)
        if (!prefs.getBoolean("setup_done", false)) {
            // first boot of ChangeOS: Fog wallpaper + system accent
            applyLook(home.look)
            prefs.edit().putBoolean("setup_done", true).apply()
        }
        styleBars(home.look)
        registerReceiver(packageChanges, IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED); addAction(Intent.ACTION_PACKAGE_REMOVED); addAction(Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }, RECEIVER_NOT_EXPORTED)
        reloadApps()
        PlayGuard.enforce(this)
        handleLookExtras(intent)
    }

    override fun onDestroy() { unregisterReceiver(packageChanges); super.onDestroy() }

    override fun onResume() { super.onResume(); home.invalidate() }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        closeDrawer()  // pressing home while on home closes the drawer
        handleLookExtras(intent)
    }

    /** `am start -n os.changeos.launcher/.HomeActivity --es theme loud --es accent FF2E88` (used by CI and the terminal) */
    private fun handleLookExtras(intent: Intent?) {
        val theme = intent?.getStringExtra("theme")
        val accent = intent?.getStringExtra("accent")?.let { runCatching { Color.parseColor("#" + it.removePrefix("#")) }.getOrNull() }
        if (theme == null && accent == null) return
        var look = home.look
        if (theme != null && theme in Look.THEMES) look = look.copy(theme = theme)
        if (accent != null) look = look.copy(accent = accent)
        applyLook(look)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { closeDrawer() }

    private fun reloadApps() {
        apps = Apps.all(this)
        home.grid = Apps.pick(apps, Apps.GRID)
        home.dock = Apps.pick(apps, Apps.DOCK)
    }

    override fun onOpen(app: App) { closeDrawer(); Apps.launch(this, app) }

    override fun onOpenNotifications() {
        try {
            val sbm = getSystemService("statusbar")
            sbm.javaClass.getMethod("expandNotificationsPanel").invoke(sbm)
        } catch (_: Throwable) {}
    }

    // ---------- app drawer ----------
    override fun onOpenDrawer() {
        if (drawer != null) return
        val look = home.look
        val gv = GridView(this).apply {
            numColumns = 4
            verticalSpacing = (18 * dp).toInt()
            setPadding((14 * dp).toInt(), (64 * dp).toInt(), (14 * dp).toInt(), (40 * dp).toInt())
            clipToPadding = false
            setBackgroundColor((look.wall and 0x00FFFFFF) or 0xF5000000.toInt())
            adapter = object : BaseAdapter() {
                override fun getCount() = apps.size
                override fun getItem(i: Int) = apps[i]
                override fun getItemId(i: Int) = i.toLong()
                override fun getView(i: Int, convert: View?, parent: ViewGroup?): View {
                    val app = apps[i]
                    val cell = (convert as? LinearLayout) ?: LinearLayout(this@HomeActivity).apply {
                        orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
                        addView(ImageView(context), LinearLayout.LayoutParams((60 * dp).toInt(), (60 * dp).toInt()))
                        addView(TextView(context).apply { textSize = 12f; gravity = Gravity.CENTER; maxLines = 1; setPadding(0, (6 * dp).toInt(), 0, 0) })
                    }
                    val iv = cell.getChildAt(0) as ImageView
                    val bg = GradientDrawable().apply { cornerRadius = 18 * dp; setColor(look.card) }
                    iv.background = bg
                    val px = (38 * dp).toInt()
                    iv.setImageBitmap(Apps.monoIcon(app, px, look.iconTint))
                    iv.scaleType = ImageView.ScaleType.CENTER
                    (cell.getChildAt(1) as TextView).apply { text = app.label; setTextColor(look.fg) }
                    return cell
                }
            }
            setOnItemClickListener { _, _, i, _ -> onOpen(apps[i]) }
        }
        drawer = gv
        gv.alpha = 0f; gv.translationY = 80 * dp
        root.addView(gv, FrameLayout.LayoutParams(-1, -1))
        gv.animate().alpha(1f).translationY(0f).setDuration(220).start()
    }

    private fun closeDrawer() {
        val d = drawer ?: return
        drawer = null
        d.animate().alpha(0f).translationY(60 * dp).setDuration(160).withEndAction { root.removeView(d) }.start()
    }

    // ---------- themes and accent ----------
    override fun onCustomize() {
        var look = home.look
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding((24 * dp).toInt(), (12 * dp).toInt(), (24 * dp).toInt(), 0) }
        fun label(t: String) = TextView(this).apply { text = t; textSize = 14f; typeface = Typeface.DEFAULT_BOLD; setPadding(0, (14 * dp).toInt(), 0, (8 * dp).toInt()) }
        box.addView(label("Theme"))
        val themes = LinearLayout(this)
        Look.THEMES.forEach { t ->
            themes.addView(TextView(this).apply {
                text = t.replaceFirstChar { it.uppercase() }; textSize = 15f; gravity = Gravity.CENTER
                setPadding((16 * dp).toInt(), (10 * dp).toInt(), (16 * dp).toInt(), (10 * dp).toInt())
                background = GradientDrawable().apply { cornerRadius = 99 * dp; setColor(0xFFECECEF.toInt()) }
                setOnClickListener { look = look.copy(theme = t); applyLook(look) }
            }, LinearLayout.LayoutParams(-2, -2).apply { rightMargin = (8 * dp).toInt() })
        }
        box.addView(themes)
        box.addView(label("Accent, used across the whole system"))
        val swatches = LinearLayout(this)
        Look.ACCENTS.forEach { a ->
            swatches.addView(View(this).apply {
                background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(a) }
                setOnClickListener { look = look.copy(accent = a); applyLook(look) }
            }, LinearLayout.LayoutParams((40 * dp).toInt(), (40 * dp).toInt()).apply { rightMargin = (10 * dp).toInt() })
        }
        box.addView(swatches)
        AlertDialog.Builder(this).setTitle("ChangeOS look").setView(box).setPositiveButton("Done", null).show()
    }

    private fun applyLook(look: Look) {
        Look.save(this, look)  // also pushes the accent system-wide
        home.look = look
        styleBars(look)
        // solid wallpaper in the theme color, so the lock screen and recents match
        try {
            val bmp = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888).apply { eraseColor(look.wall) }
            WallpaperManager.getInstance(this).setBitmap(bmp)
        } catch (_: Exception) {}
    }

    private fun styleBars(look: Look) {
        val light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
        window.insetsController?.setSystemBarsAppearance(if (look.lightBars) light else 0, light)
    }
}
