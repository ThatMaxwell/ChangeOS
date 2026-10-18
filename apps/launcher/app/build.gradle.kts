plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "os.changeos.launcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "os.changeos.launcher"
        minSdk = 33
        targetSdk = 35
        versionCode = 1
        versionName = "1.0 Sweet Vanilla"
    }
    // ChangeOS release key (CI decodes it from the CHANGEOS_KEYSTORE_B64 secret). Its certificate is
    // trusted for restricted settings via /system/etc/sysconfig/changeos-ecm.xml. Falls back to debug.
    val ksPath = System.getenv("CHANGEOS_KEYSTORE")
    signingConfigs {
        if (ksPath != null && file(ksPath).exists()) create("changeos") {
            storeFile = file(ksPath)
            storePassword = System.getenv("CHANGEOS_KEYSTORE_PASSWORD")
            keyAlias = "changeos"
            keyPassword = System.getenv("CHANGEOS_KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("changeos") ?: signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
