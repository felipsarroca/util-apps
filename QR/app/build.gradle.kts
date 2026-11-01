plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }

android {
    namespace = "cat.felipsarroca.lectorqr"
    buildFeatures { buildConfig = true }
    compileSdk = 36
    defaultConfig {
        applicationId = "cat.felipsarroca.lectorqr"
        minSdk = 26
        targetSdk = 36
        versionCode = 4
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = if (providers.environmentVariable("QR_KEYSTORE_FILE").isPresent) {
                signingConfigs.create("release") {
                    storeFile = file(providers.environmentVariable("QR_KEYSTORE_FILE").get())
                    storePassword = providers.environmentVariable("QR_KEYSTORE_PASSWORD").get()
                    keyAlias = providers.environmentVariable("QR_KEY_ALIAS").get()
                    keyPassword = providers.environmentVariable("QR_KEY_PASSWORD").get()
                }
            } else null
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    val camera = "1.6.2"
    implementation("androidx.camera:camera-camera2:$camera")
    implementation("androidx.camera:camera-lifecycle:$camera")
    implementation("androidx.camera:camera-view:$camera")
    implementation("androidx.activity:activity-ktx:1.12.4")
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("io.github.zxing-cpp:android:3.1.1")
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
