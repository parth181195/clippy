allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)

    // Some plugins (e.g. receive_sharing_intent) compile Java to 1.8 but Kotlin
    // to 17, which newer Gradle rejects as inconsistent. Pin every subproject's
    // Java + Kotlin target to 17 so they always match. Registered here (before
    // the evaluationDependsOn below forces evaluation).
    afterEvaluate {
        extensions.findByName("android")?.let { ext ->
            runCatching {
                (ext as com.android.build.gradle.BaseExtension).compileOptions {
                    sourceCompatibility = JavaVersion.VERSION_17
                    targetCompatibility = JavaVersion.VERSION_17
                }
            }
        }
        tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
            compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
            // sentry_flutter's Android module pins Kotlin language version 1.6,
            // which the project's Kotlin 2.x compiler no longer supports. Bump it
            // to 1.8 for just that subproject so it compiles.
            if (project.name == "sentry_flutter") {
                compilerOptions.languageVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_1_8)
                compilerOptions.apiVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_1_8)
            }
        }
    }
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
