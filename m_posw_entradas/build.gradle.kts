// Versiones de plugins centralizadas. Los módulos aplican los IDs sin versión.
// (El bloque buildscript/allprojects anterior rompía con
// repositoriesMode FAIL_ON_PROJECT_REPOS de settings.gradle.kts.)
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
    id("org.jetbrains.kotlin.plugin.parcelize") version "1.9.24" apply false
    id("com.google.devtools.ksp") version "1.9.24-1.0.20" apply false
}
