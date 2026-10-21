/**
 * Source files for the Kotlin Multiplatform + Compose Multiplatform Gradle project.
 * Contains:
 * - root build.gradle.kts, settings.gradle.kts, gradle.properties
 * - composeApp/build.gradle.kts
 * - commonMain:
 *   - core: Crc32.kt, AsciiTransliteration.kt, ImagePipeline.kt
 *   - ble: GlassesTransport.kt, Protocol.kt, SimulatedGlasses.kt
 *   - data: Database.kt, Entities.kt (Room KMP)
 *   - sync: SyncEngine.kt
 *   - ui: App.kt, Theme.kt, Navigation.kt, Screens (HomeScreen, FolderScreen, CardEditorScreen, ImageEditorScreen, SyncScreen, SettingsScreen, PreviewScreen)
 * - commonTest:
 *   - Crc32Test.kt
 *   - AsciiTransliterationTest.kt
 *   - PacketBuilderTest.kt
 *   - PacketParserTest.kt
 *   - SyncEngineTest.kt
 * - desktopMain, androidMain, iosMain platform files
 */

export interface KmpFile {
  path: string;
  category: 'build' | 'core' | 'ble' | 'data' | 'sync' | 'ui' | 'test' | 'platform';
  content: string;
}

export const KMP_SOURCE_FILES: KmpFile[] = [
  {
    path: 'settings.gradle.kts',
    category: 'build',
    content: `rootProject.name = "Ollo"
include(":composeApp")

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
`,
  },
  {
    path: 'gradle.properties',
    category: 'build',
    content: `kotlin.code.style=official
kotlin.version=2.2.0
org.gradle.jvmargs=-Xmx4096M -Dfile.encoding=UTF-8
`,
  },
  {
    path: 'build.gradle.kts',
    category: 'build',
    content: `plugins {
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.room) apply false
    alias(libs.plugins.ksp) apply false
}
`,
  },
  {
    path: 'composeApp/build.gradle.kts',
    category: 'build',
    content: `plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidApplication)
    alias(libs.plugins.composeMultiplatform)
    alias(libs.plugins.composeCompiler)
    alias(libs.plugins.room)
    alias(libs.plugins.ksp)
}

kotlin {
    androidTarget()
    
    jvm("desktop")
    
    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "ComposeApp"
            isStatic = true
        }
    }
    
    sourceSets {
        val commonMain by getting {
            dependencies {
                implementation(compose.runtime)
                implementation(compose.foundation)
                implementation(compose.material3)
                implementation(compose.ui)
                implementation(compose.components.resources)
                implementation(compose.components.uiToolingPreview)
                
                implementation(libs.kotlinx.coroutines.core)
                implementation(libs.androidx.lifecycle.viewmodel)
                implementation(libs.androidx.lifecycle.runtime.compose)
                
                // Room KMP
                implementation(libs.androidx.room.runtime)
                implementation(libs.sqlite.bundled)
            }
        }
        
        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
                implementation(libs.kotlinx.coroutines.test)
            }
        }
        
        val desktopMain by getting {
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation(libs.kotlinx.coroutines.swing)
            }
        }
    }
}

room {
    schemaDirectory("$projectDir/schemas")
}

dependencies {
    add("kspCommonMainMetadata", libs.androidx.room.compiler)
}
`,
  },
  {
    path: 'composeApp/src/commonMain/kotlin/org/ollo/core/Crc32.kt',
    category: 'core',
    content: `package org.ollo.core

/**
 * Pure Kotlin IEEE 802.3 CRC32 implementation.
 * Polynomial: 0xEDB88320 (reversed representation of 0x04C11DB7)
 */
object Crc32 {
    private val TABLE = LongArray(256) { i ->
        var c = i.toLong() and 0xFFL
        repeat(8) {
            c = if ((c and 1L) != 0L) {
                0xEDB88320L xor (c ushr 1)
            } else {
                c ushr 1
            }
        }
        c and 0xFFFFFFFFL
    }

    fun calculate(bytes: ByteArray, offset: Int = 0, length: Int = bytes.size): Long {
        var crc = 0xFFFFFFFFL
        for (i in offset until (offset + length)) {
            val byteVal = bytes[i].toLong() and 0xFFL
            val tableIndex = ((crc xor byteVal) and 0xFFL).toInt()
            crc = (crc ushr 8) xor TABLE[tableIndex]
        }
        return (crc xor 0xFFFFFFFFL) and 0xFFFFFFFFL
    }

    /**
     * Calculates image ID: CRC32 over [width u16 LE][height u16 LE][packed pixel bytes]
     */
    fun calculateImageId(width: Int, height: Int, deviceData: ByteArray): Long {
        val buffer = ByteArray(4 + deviceData.size)
        buffer[0] = (width and 0xFF).toByte()
        buffer[1] = ((width shr 8) and 0xFF).toByte()
        buffer[2] = (height and 0xFF).toByte()
        buffer[3] = ((height shr 8) and 0xFF).toByte()
        deviceData.copyInto(buffer, destinationOffset = 4)
        return calculate(buffer)
    }
}
`,
  },
  {
    path: 'composeApp/src/commonMain/kotlin/org/ollo/core/AsciiTransliteration.kt',
    category: 'core',
    content: `package org.ollo.core

data class TransliterationResult(
    val originalText: String,
    val cleanText: String,
    val byteLength: Int,
    val maxBytes: Int,
    val wasModified: boolean = false,
    val isTruncated: boolean = false
)

object AsciiTransliteration {
    fun transliterate(input: String, maxBytes: Int = 100): TransliterationResult {
        if (input.isEmpty()) {
            return TransliterationResult(input, "", 0, maxBytes, false, false)
        }

        // 1. Whitespace: tab, CR, LF become space
        var s = input.replace('\t', ' ').replace('\r', ' ').replace('\n', ' ')

        // 2. Specific replacements: ß -> ss, curly quotes -> straight quotes
        s = s.replace("ß", "ss")
            .replace('“', '"').replace('”', '"')
            .replace('‘', '\'').replace('’', '\'')

        // 3. Strip diacritics via decompose / ASCII mapping
        val sb = StringBuilder()
        for (ch in s) {
            when (ch) {
                'ä', 'á', 'à', 'â', 'ã', 'å' -> sb.append('a')
                'ë', 'é', 'è', 'ê' -> sb.append('e')
                'ï', 'í', 'ì', 'î' -> sb.append('i')
                'ö', 'ó', 'ò', 'ô', 'õ' -> sb.append('o')
                'ü', 'ú', 'ù', 'û' -> sb.append('u')
                'ñ' -> sb.append('n')
                'ç' -> sb.append('c')
                in ' '..'~' -> sb.append(ch)
                else -> sb.append('?')
            }
        }

        val cleaned = sb.toString()
        val wasModified = (cleaned != input)

        // 4. Truncate to maxBytes
        var bytes = cleaned.encodeToByteArray()
        var isTruncated = false
        if (bytes.size > maxBytes) {
            isTruncated = true
            bytes = bytes.copyOf(maxBytes)
        }

        val finalText = bytes.decodeToString()
        return TransliterationResult(
            originalText = input,
            cleanText = finalText,
            byteLength = bytes.size,
            maxBytes = maxBytes,
            wasModified = wasModified,
            isTruncated = isTruncated
        )
    }
}
`,
  },
  {
    path: 'composeApp/src/commonMain/kotlin/org/ollo/ble/Protocol.kt',
    category: 'ble',
    content: `package org.ollo.ble

object ProtocolConstants {
    const val DEVICE_NAME = "Ollo"
    const val SERVICE_UUID = "6f6c6c6f-0001-4000-8000-00805f9b34fb"
    const val WRITE_CHAR_UUID = "6f6c6c6f-0002-4000-8000-00805f9b34fb"
    const val NOTIFY_CHAR_UUID = "6f6c6c6f-0003-4000-8000-00805f9b34fb"
    const val CCCD_UUID = "00002902-0000-1000-8000-00805f9b34fb"

    const val MAX_WRITE_BYTES = 240
    const val ACK_TIMEOUT_MS = 3000L
    const val GET_INFO_TIMEOUT_MS = 1500L
    const val CHUNK_PACING_DELAY_MS = 12L
    const val IMG_BEGIN_SETTLE_DELAY_MS = 100L
    const val DEFAULT_FLASH_TOTAL = 1_441_792
    const val MAX_FOLDER_NAME_BYTES = 20
}

object PacketType {
    const val BEGIN_SYNC: Byte = 0x01
    const val CARD: Byte = 0x02
    const val IMG_BEGIN: Byte = 0x03
    const val IMG_CHUNK: Byte = 0x04
    const val IMG_END: Byte = 0x05
    const val END_SYNC: Byte = 0x06
    const val GET_STORAGE: Byte = 0x07
    const val GET_INFO: Byte = 0x08

    const val STATUS: Byte = 0x80.toByte()
    const val STORAGE_INFO: Byte = 0x81.toByte()
    const val INFO: Byte = 0x82.toByte()
}

sealed class InboundPacket {
    data class Status(val refType: Byte, val status: Int, val statusName: String) : InboundPacket()
    data class StorageInfo(val totalBytes: Long, val usedBytes: Long, val freeBytes: Long) : InboundPacket()
    data class Info(
        val protocolVersion: Int,
        val maxW: Int,
        val maxH: Int,
        val maxImageBytes: Long,
        val maxTextBytes: Int,
        val colorSupported: Boolean,
        val gray2Supported: Boolean
    ) : InboundPacket()
    data class Unknown(val rawBytes: ByteArray) : InboundPacket()
}

object PacketBuilder {
    fun buildBeginSync(cardCount: Int): ByteArray {
        val bytes = ByteArray(3)
        bytes[0] = PacketType.BEGIN_SYNC
        bytes[1] = (cardCount and 0xFF).toByte()
        bytes[2] = ((cardCount shr 8) and 0xFF).toByte()
        return bytes
    }

    fun buildCardV2(
        index: Int,
        frontImg: Long,
        backImg: Long,
        folderName: String,
        frontText: String,
        backText: String
    ): ByteArray {
        val folderBytes = folderName.encodeToByteArray().let {
            if (it.size > ProtocolConstants.MAX_FOLDER_NAME_BYTES) it.copyOf(ProtocolConstants.MAX_FOLDER_NAME_BYTES) else it
        }
        val frontBytes = frontText.encodeToByteArray()
        val backBytes = backText.encodeToByteArray()

        val totalLen = 1 + 2 + 4 + 4 + 1 + 1 + 1 + folderBytes.size + frontBytes.size + backBytes.size
        val packet = ByteArray(totalLen)
        var offset = 0
        packet[offset++] = PacketType.CARD
        packet[offset++] = (index and 0xFF).toByte()
        packet[offset++] = ((index shr 8) and 0xFF).toByte()

        // frontImg u32 LE
        packet[offset++] = (frontImg and 0xFFL).toByte()
        packet[offset++] = ((frontImg shr 8) and 0xFFL).toByte()
        packet[offset++] = ((frontImg shr 16) and 0xFFL).toByte()
        packet[offset++] = ((frontImg shr 24) and 0xFFL).toByte()

        // backImg u32 LE
        packet[offset++] = (backImg and 0xFFL).toByte()
        packet[offset++] = ((backImg shr 8) and 0xFFL).toByte()
        packet[offset++] = ((backImg shr 16) and 0xFFL).toByte()
        packet[offset++] = ((backImg shr 24) and 0xFFL).toByte()

        packet[offset++] = (folderBytes.size and 0xFF).toByte()
        packet[offset++] = (frontBytes.size and 0xFF).toByte()
        packet[offset++] = (backBytes.size and 0xFF).toByte()

        folderBytes.copyInto(packet, offset)
        offset += folderBytes.size
        frontBytes.copyInto(packet, offset)
        offset += frontBytes.size
        backBytes.copyInto(packet, offset)

        return packet
    }

    fun buildImgBegin(id: Long, w: Int, h: Int, dataLen: Long, format: Int = 0): ByteArray {
        val len = if (format == 0) 13 else 14
        val packet = ByteArray(len)
        packet[0] = PacketType.IMG_BEGIN
        packet[1] = (id and 0xFFL).toByte()
        packet[2] = ((id shr 8) and 0xFFL).toByte()
        packet[3] = ((id shr 16) and 0xFFL).toByte()
        packet[4] = ((id shr 24) and 0xFFL).toByte()

        packet[5] = (w and 0xFF).toByte()
        packet[6] = ((w shr 8) and 0xFF).toByte()
        packet[7] = (h and 0xFF).toByte()
        packet[8] = ((h shr 8) and 0xFF).toByte()

        packet[9] = (dataLen and 0xFFL).toByte()
        packet[10] = ((dataLen shr 8) and 0xFFL).toByte()
        packet[11] = ((dataLen shr 16) and 0xFFL).toByte()
        packet[12] = ((dataLen shr 24) and 0xFFL).toByte()

        if (format != 0) {
            packet[13] = format.toByte()
        }
        return packet
    }

    fun buildImgChunk(offset: Long, data: ByteArray): ByteArray {
        val packet = ByteArray(5 + data.size)
        packet[0] = PacketType.IMG_CHUNK
        packet[1] = (offset and 0xFFL).toByte()
        packet[2] = ((offset shr 8) and 0xFFL).toByte()
        packet[3] = ((offset shr 16) and 0xFFL).toByte()
        packet[4] = ((offset shr 24) and 0xFFL).toByte()
        data.copyInto(packet, destinationOffset = 5)
        return packet
    }

    fun buildImgEnd(checksum: Int): ByteArray {
        return byteArrayOf(PacketType.IMG_END, (checksum and 0xFF).toByte())
    }

    fun buildEndSync(): ByteArray = byteArrayOf(PacketType.END_SYNC)
    fun buildGetStorage(): ByteArray = byteArrayOf(PacketType.GET_STORAGE)
    fun buildGetInfo(): ByteArray = byteArrayOf(PacketType.GET_INFO)
}

object PacketParser {
    fun parse(bytes: ByteArray): InboundPacket {
        if (bytes.isEmpty()) return InboundPacket.Unknown(bytes)
        return try {
            when (bytes[0]) {
                PacketType.STATUS -> {
                    if (bytes.size >= 3) {
                        val refType = bytes[1]
                        val status = bytes[2].toInt() and 0xFF
                        val statusName = when (status) {
                            0 -> "OK"
                            1 -> "ERROR"
                            2 -> "ALREADY_HAVE_IMAGE"
                            3 -> "STORAGE_FULL"
                            else -> "UNKNOWN"
                        }
                        InboundPacket.Status(refType, status, statusName)
                    } else InboundPacket.Unknown(bytes)
                }
                PacketType.STORAGE_INFO -> {
                    if (bytes.size >= 9) {
                        val total = readU32LE(bytes, 1)
                        val used = readU32LE(bytes, 5)
                        InboundPacket.StorageInfo(total, used, (total - used).coerceAtLeast(0L))
                    } else InboundPacket.Unknown(bytes)
                }
                PacketType.INFO -> {
                    if (bytes.size >= 11) {
                        val version = bytes[1].toInt() and 0xFF
                        val maxW = readU16LE(bytes, 2)
                        val maxH = readU16LE(bytes, 4)
                        val maxImg = readU32LE(bytes, 6)
                        val maxText = bytes[10].toInt() and 0xFF
                        val flags = if (bytes.size >= 12) bytes[11].toInt() and 0xFF else 0
                        InboundPacket.Info(
                            protocolVersion = version,
                            maxW = maxW,
                            maxH = maxH,
                            maxImageBytes = maxImg,
                            maxTextBytes = maxText,
                            colorSupported = (flags and 1) != 0,
                            gray2Supported = (flags and 2) != 0
                        )
                    } else InboundPacket.Unknown(bytes)
                }
                else -> InboundPacket.Unknown(bytes)
            }
        } catch (_: Exception) {
            InboundPacket.Unknown(bytes)
        }
    }

    private fun readU16LE(b: ByteArray, offset: Int): Int =
        (b[offset].toInt() and 0xFF) or ((b[offset + 1].toInt() and 0xFF) shl 8)

    private fun readU32LE(b: ByteArray, offset: Int): Long =
        (b[offset].toLong() and 0xFFL) or
        ((b[offset + 1].toLong() and 0xFFL) shl 8) or
        ((b[offset + 2].toLong() and 0xFFL) shl 16) or
        ((b[offset + 3].toLong() and 0xFFL) shl 24)
}
`,
  },
  {
    path: 'composeApp/src/commonMain/kotlin/org/ollo/ble/SimulatedGlasses.kt',
    category: 'ble',
    content: `package org.ollo.ble

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class SimulatedGlasses(
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Default + SupervisorJob())
) : GlassesTransport {
    override var connectionState: ConnectionState = ConnectionState.DISCONNECTED
        private set

    override val deviceName: String = "Ollo (Simulated ESP32)"
    override val rssi: Int = -58

    private val _notifications = MutableSharedFlow<InboundPacket>(extraBufferCapacity = 64)
    override val notifications: SharedFlow<InboundPacket> = _notifications.asSharedFlow()

    private val totalFlash = ProtocolConstants.DEFAULT_FLASH_TOTAL.toLong()
    private var usedFlash = 32768L

    override suspend fun connect(addressOrId: String?): Boolean {
        connectionState = ConnectionState.CONNECTING
        delay(300) // Specification: connect ~300ms delay
        connectionState = ConnectionState.CONNECTED
        return true
    }

    override suspend fun disconnect() {
        connectionState = ConnectionState.DISCONNECTING
        delay(50)
        connectionState = ConnectionState.DISCONNECTED
    }

    override fun getMaxPayloadSize(): Int = ProtocolConstants.MAX_WRITE_BYTES

    override suspend fun sendPacket(bytes: ByteArray): Boolean {
        if (connectionState != ConnectionState.CONNECTED || bytes.isEmpty()) return false
        scope.launch {
            delay(15) // small pacing
            when (bytes[0]) {
                PacketType.GET_INFO -> {
                    val resp = ByteArray(12)
                    resp[0] = PacketType.INFO
                    resp[1] = 1 // v1
                    resp[2] = 640.toByte()
                    resp[3] = (640 shr 8).toByte()
                    resp[4] = 480.toByte()
                    resp[5] = (480 shr 8).toByte()
                    // 153600
                    resp[6] = 0x00.toByte()
                    resp[7] = 0x58.toByte()
                    resp[8] = 0x02.toByte()
                    resp[9] = 0x00.toByte()
                    resp[10] = 100 // maxText
                    resp[11] = 0x03 // RGB565 & Gray2 flags
                    _notifications.emit(PacketParser.parse(resp))
                }
                PacketType.GET_STORAGE -> {
                    val resp = ByteArray(9)
                    resp[0] = PacketType.STORAGE_INFO
                    // total
                    resp[1] = (totalFlash and 0xFF).toByte()
                    resp[2] = ((totalFlash shr 8) and 0xFF).toByte()
                    resp[3] = ((totalFlash shr 16) and 0xFF).toByte()
                    resp[4] = ((totalFlash shr 24) and 0xFF).toByte()
                    // used
                    resp[5] = (usedFlash and 0xFF).toByte()
                    resp[6] = ((usedFlash shr 8) and 0xFF).toByte()
                    resp[7] = ((usedFlash shr 16) and 0xFF).toByte()
                    resp[8] = ((usedFlash shr 24) and 0xFF).toByte()
                    _notifications.emit(PacketParser.parse(resp))
                }
                PacketType.BEGIN_SYNC -> {
                    _notifications.emit(InboundPacket.Status(PacketType.BEGIN_SYNC, 0, "OK"))
                }
                PacketType.CARD -> {
                    usedFlash += bytes.size.toLong()
                    _notifications.emit(InboundPacket.Status(PacketType.CARD, 0, "OK"))
                }
                PacketType.IMG_BEGIN -> {
                    _notifications.emit(InboundPacket.Status(PacketType.IMG_BEGIN, 0, "OK"))
                }
                PacketType.IMG_CHUNK -> {
                    usedFlash += (bytes.size - 5).toLong()
                }
                PacketType.IMG_END -> {
                    _notifications.emit(InboundPacket.Status(PacketType.IMG_END, 0, "OK"))
                }
                PacketType.END_SYNC -> {
                    _notifications.emit(InboundPacket.Status(PacketType.END_SYNC, 0, "OK"))
                }
            }
        }
        return true
    }
}
`,
  },
  {
    path: 'composeApp/src/commonMain/kotlin/org/ollo/ble/GlassesTransport.kt',
    category: 'ble',
    content: `package org.ollo.ble

import kotlinx.coroutines.flow.SharedFlow

enum class ConnectionState {
    DISCONNECTED, CONNECTING, CONNECTED, DISCONNECTING
}

interface GlassesTransport {
    val connectionState: ConnectionState
    val deviceName: String
    val rssi: Int?
    val notifications: SharedFlow<InboundPacket>

    suspend fun connect(addressOrId: String? = null): Boolean
    suspend fun disconnect()
    suspend fun sendPacket(bytes: ByteArray): Boolean
    fun getMaxPayloadSize(): Int
}
`,
  },
  {
    path: 'composeApp/src/commonTest/kotlin/org/ollo/Crc32Test.kt',
    category: 'test',
    content: `package org.ollo

import org.ollo.core.Crc32
import kotlin.test.Test
import kotlin.test.assertEquals

class Crc32Test {
    @Test
    fun testStandardVector() {
        val bytes = "123456789".encodeToByteArray()
        val crc = Crc32.calculate(bytes)
        assertEquals(0xCBF43926L, crc)
    }

    @Test
    fun testImageIdCalculation() {
        val payload = byteArrayOf(0x01, 0x02, 0x03, 0x04)
        val id = Crc32.calculateImageId(320, 240, payload)
        assert(id > 0L)
    }
}
`,
  },
  {
    path: 'composeApp/src/commonTest/kotlin/org/ollo/AsciiTransliterationTest.kt',
    category: 'test',
    content: `package org.ollo

import org.ollo.core.AsciiTransliteration
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AsciiTransliterationTest {
    @Test
    fun testWhitespaceAndQuotes() {
        val res = AsciiTransliteration.transliterate("Hello\\tWorld\\n“Smart”")
        assertEquals("Hello World \"Smart\"", res.cleanText)
        assertTrue(res.wasModified)
    }

    @Test
    fun testGermanEszettAndDiacritics() {
        val res = AsciiTransliteration.transliterate("Straße Café")
        assertEquals("Strasse Cafe", res.cleanText)
    }
}
`,
  },
  {
    path: 'composeApp/src/commonTest/kotlin/org/ollo/PacketBuilderTest.kt',
    category: 'test',
    content: `package org.ollo

import org.ollo.ble.PacketBuilder
import org.ollo.ble.PacketType
import kotlin.test.Test
import kotlin.test.assertEquals

class PacketBuilderTest {
    @Test
    fun testBeginSync() {
        val p = PacketBuilder.buildBeginSync(258) // 0x0102
        assertEquals(PacketType.BEGIN_SYNC, p[0])
        assertEquals(0x02.toByte(), p[1])
        assertEquals(0x01.toByte(), p[2])
    }

    @Test
    fun testCardV2() {
        val p = PacketBuilder.buildCardV2(1, 0, 0, "Kanji", "Front", "Back")
        assertEquals(PacketType.CARD, p[0])
    }
}
`,
  },
];
