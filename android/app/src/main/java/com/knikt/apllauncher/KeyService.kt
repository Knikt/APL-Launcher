package com.knikt.apllauncher

import android.accessibilityservice.AccessibilityService
import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.Log
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import org.json.JSONObject

/* The remote over every app, without root (turned on in Settings › Accessibility, or with adb):
   - Home held: the Control Center over the app in front (Overlay.kt), or the launcher's own one.
   - ⏯ in an app: the Control Center too, unless Settings › Remote says "Play and Pause".
   - Home pressed: APL Launcher. Android TV 12+ and Google TV keep their own launcher on the Home button
     whatever the default (tried on Android TV 14), so this service opens APL Launcher itself
     ("catchHome", the user's choice), and again whenever the device's own home comes up on its own
     (an app closed, the device started), unless the Smart Hub tile asked for it.
   - The app in front: the App Switcher's order, and Close Unused Apps (10 minutes in the background).
   Only key presses and the name of the app in front are seen: no window content (key_service.xml). */
class KeyService : AccessibilityService() {
    companion object {
        @Volatile var instance: KeyService? = null
        @Volatile var front: String = ""
        private val recentApps = ArrayList<String>()
        @Volatile private var stockUntil = 0L
        private const val LONG_MS = 600L
        private const val IDLE_MS = 10 * 60 * 1000L

        fun recent(): List<String> = synchronized(recentApps) { ArrayList(recentApps) }

        /* The Smart Hub tile opens Google's home on purpose: it stays there for that long. */
        fun allowStockHome(ms: Long) { stockUntil = SystemClock.uptimeMillis() + ms }

        fun action(a: Int): Boolean {
            val s = instance ?: return false
            if (a == GLOBAL_ACTION_LOCK_SCREEN && Build.VERSION.SDK_INT < 28) return false
            return try { s.performGlobalAction(a) } catch (e: Exception) { false }
        }

        fun isOn(ctx: Context): Boolean {
            if (instance != null) return true
            val list = Settings.Secure.getString(ctx.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: ""
            return list.split(':').any { it.startsWith(ctx.packageName + "/") }
        }

        /* Home opens APL Launcher, even where the device's own launcher keeps the button (the user's
           choice, on unless turned off in Settings) */
        fun catchHome(ctx: Context): Boolean = (Bridge.prefs(ctx).getString("catchHome", "") ?: "") != "0"
    }

    private val h = Handler(Looper.getMainLooper())
    private var homeLong = false
    private var ownHomeUntil = 0L
    private var homes = setOf<String>()
    private val activities = HashMap<String, Boolean>()
    private val leftAt = HashMap<String, Long>()
    private val longHome = Runnable { homeLong = true; onLongHome() }
    private val idleCheck = object : Runnable {
        override fun run() { closeIdle(); h.postDelayed(this, 60 * 1000L) }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        homes = AppList.otherHomes(this).map { it.packageName }.toSet()
        h.postDelayed(idleCheck, 60 * 1000L)
        MainActivity.event("accessibility", "true")
        Log.i(Web.TAG, "key service on (other launchers: $homes)")
    }

    override fun onDestroy() {
        instance = null
        h.removeCallbacksAndMessages(null)
        Overlay.destroy()
        MainActivity.event("accessibility", "false")
        super.onDestroy()
    }

    override fun onInterrupt() {}

    /* ---------- the app in front ---------- */
    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        if (e.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = e.packageName?.toString() ?: return
        val cls = e.className?.toString() ?: return
        if (pkg == front || !isActivity(pkg, cls)) return       // a toast, a dialog, the keyboard…
        val now = SystemClock.uptimeMillis()
        if (front.isNotEmpty()) leftAt[front] = now
        leftAt.remove(pkg)
        front = pkg
        if (pkg != packageName && !homes.contains(pkg)) synchronized(recentApps) {
            recentApps.remove(pkg); recentApps.add(0, pkg)
            while (recentApps.size > 12) recentApps.removeAt(recentApps.size - 1)
        }
        MainActivity.event("front", JSONObject.quote(pkg))
        // Google's home came up by itself (an app closed, the device started): APL Launcher instead
        if (homes.contains(pkg) && catchHome(this) && now > stockUntil && homeReturn()) {
            h.postDelayed({ if (front == pkg) openLauncher(true) }, 120)
        }
    }

    private fun isActivity(pkg: String, cls: String): Boolean {
        val key = "$pkg/$cls"
        activities[key]?.let { return it }
        val yes = try { packageManager.getActivityInfo(ComponentName(pkg, cls), 0); true } catch (e: Exception) { false }
        activities[key] = yes
        return yes
    }

    private fun homeReturn() = (Bridge.prefs(this).getString("homeReturn", "") ?: "") != "0"

    /* ---------- the remote ---------- */
    override fun onKeyEvent(e: KeyEvent): Boolean {
        return when (e.keyCode) {
            KeyEvent.KEYCODE_HOME -> onHome(e)
            KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> onPlayPause(e)
            else -> false
        }
    }

    private fun onHome(e: KeyEvent): Boolean {
        if (Web.isDebuggable(this)) Log.d(Web.TAG, "home action=${e.action} repeat=${e.repeatCount} flags=${Integer.toHexString(e.flags)} long=$homeLong")
        // Android's own Home, sent just now by this service: through, or it would come back here forever
        if (SystemClock.uptimeMillis() < ownHomeUntil) return false
        if (e.action == KeyEvent.ACTION_DOWN) {
            if (e.repeatCount == 0) { homeLong = false; h.removeCallbacks(longHome); h.postDelayed(longHome, LONG_MS) }
            // Android marks the held key itself (its long-press delay): no need to wait for the timer
            else if (!homeLong && (e.flags and KeyEvent.FLAG_LONG_PRESS) != 0) { h.removeCallbacks(longHome); longHome.run() }
            return true
        }
        if (e.action == KeyEvent.ACTION_UP) {
            h.removeCallbacks(longHome)
            if (!homeLong) shortHome()
            homeLong = false
        }
        return true
    }

    private fun shortHome() {
        Overlay.hide()
        if (!AppList.isDefaultHome(this) && catchHome(this)) { openLauncher(true); return }
        ownHomeUntil = SystemClock.uptimeMillis() + 700
        performGlobalAction(GLOBAL_ACTION_HOME)
    }

    private fun onLongHome() {
        if (MainActivity.resumed) { MainActivity.pressKey(403); return }    // the launcher's own Control Center
        Overlay.toggle(this)
    }

    private fun onPlayPause(e: KeyEvent): Boolean {
        if (MainActivity.resumed || Overlay.isShown()) return false        // the page in front has it
        if ((Bridge.prefs(this).getString("pauseKey", "") ?: "") == "playpause") return false
        if (front.isEmpty() || homes.contains(front)) return false
        if (e.action == KeyEvent.ACTION_UP) Overlay.show(this)
        return true
    }

    private fun openLauncher(home: Boolean) {
        val i = Intent(this, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
        // Not as a HOME intent: Android would start a second launcher next to the one already open
        if (home) i.putExtra(MainActivity.EXTRA_HOME, true)
        try { startActivity(i) } catch (e: Exception) { Log.w(Web.TAG, "launcher: $e") }
    }

    /* ---------- Close Unused Apps ---------- */
    private fun closeIdle() {
        // Android 14 lets an app close only its own processes (tried: "Invalid packageName"): root's job there
        if (Build.VERSION.SDK_INT >= 34 || (Bridge.prefs(this).getString("idleClose", "") ?: "") == "0") return
        val now = SystemClock.uptimeMillis()
        val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val old = leftAt.filter { now - it.value > IDLE_MS && it.key != front && it.key != packageName && !homes.contains(it.key) }.keys
        for (pkg in old) {
            leftAt.remove(pkg)
            try { am.killBackgroundProcesses(pkg); Log.i(Web.TAG, "closed after 10 min in the background: $pkg") } catch (e: Exception) {}
        }
    }
}
