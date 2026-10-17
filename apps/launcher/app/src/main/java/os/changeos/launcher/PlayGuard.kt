package os.changeos.launcher

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log

/** ChangeOS bans the Google Play Store: if it ever gets installed, it's removed right away. */
class PlayGuard : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pkg = intent.data?.schemeSpecificPart
        if (pkg == null || pkg in BANNED) enforce(context)
    }

    companion object {
        val BANNED = setOf("com.android.vending")

        fun enforce(ctx: Context) {
            val pm = ctx.packageManager
            for (pkg in BANNED) {
                val installed = try { pm.getPackageInfo(pkg, 0); true } catch (_: PackageManager.NameNotFoundException) { false }
                if (!installed) continue
                Log.w("ChangeOS", "Google Play is banned on ChangeOS, removing $pkg")
                try {
                    val pi = PendingIntent.getBroadcast(ctx, 0, Intent("os.changeos.PLAY_REMOVED").setPackage(ctx.packageName), PendingIntent.FLAG_IMMUTABLE)
                    pm.packageInstaller.uninstall(pkg, pi.intentSender)  // silent: DELETE_PACKAGES is privileged
                } catch (e: SecurityException) {
                    Log.e("ChangeOS", "can't remove $pkg without DELETE_PACKAGES", e)
                }
            }
        }
    }
}
