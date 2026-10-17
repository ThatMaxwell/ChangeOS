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
        versionName = "0.1 Sweet Vanilla"
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            // system app: signed with the debug key here, installed as a privileged app in /system/priv-app
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
