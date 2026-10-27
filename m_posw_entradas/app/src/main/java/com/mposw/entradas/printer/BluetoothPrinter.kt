package com.mposw.entradas.printer

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.mposw.entradas.data.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.util.UUID

/**
 * Backend ESC/POS por Bluetooth SPP (impresoras externas de 58mm) para
 * teléfonos/tablets genéricos. Estrategia "conectar-imprimir-cerrar" como
 * la app Flutter discontinuada: sin socket persistente, sin hilos de fondo.
 * La venta siempre se aprueba igual y queda en Room para reimprimir.
 */
object BluetoothPrinter {
    data class BtDevice(val mac: String, val name: String)

    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    private fun adapter(ctx: Context): BluetoothAdapter? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ctx.getSystemService(BluetoothManager::class.java)?.adapter
            } else {
                @Suppress("DEPRECATION")
                BluetoothAdapter.getDefaultAdapter()
            }
        } catch (_: Exception) {
            null
        }
    }

    fun isSupported(ctx: Context): Boolean = adapter(ctx) != null

    fun isEnabled(ctx: Context): Boolean = try {
        adapter(ctx)?.isEnabled == true
    } catch (_: SecurityException) {
        false
    } catch (_: Exception) {
        false
    }

    /** Permisos de runtime faltantes (API 31+: BLUETOOTH_CONNECT). */
    fun missingPermissions(ctx: Context): List<String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return emptyList()
        val p = Manifest.permission.BLUETOOTH_CONNECT
        return if (ContextCompat.checkSelfPermission(ctx, p) == PackageManager.PERMISSION_GRANTED) {
            emptyList()
        } else {
            listOf(p)
        }
    }

    /** Equipos emparejados en ajustes del sistema. Requiere BLUETOOTH_CONNECT en 31+. */
    fun pairedDevices(ctx: Context): List<BtDevice> {
        return try {
            val bonded = adapter(ctx)?.bondedDevices ?: return emptyList()
            bonded.mapNotNull {
                val mac = try { it.address } catch (_: Exception) { null } ?: return@mapNotNull null
                val name = try { it.name ?: mac } catch (_: Exception) { mac }
                BtDevice(mac, name)
            }.sortedBy { it.name.lowercase() }
        } catch (_: SecurityException) {
            emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun printBlocks(ctx: Context, blocks: List<PrintBlock>): Result<Unit> {
        if (blocks.isEmpty()) return Result.failure(IllegalStateException("Nada para imprimir"))
        return printBytes(ctx, EscPosEncoder.encode(blocks))
    }

    /** Ticket de prueba (no depende del servidor). */
    suspend fun printTest(ctx: Context): Result<Unit> = printBlocks(
        ctx,
        listOf(
            PrintBlock.Text("PRUEBA DE IMPRESION", 28f, true),
            PrintBlock.Line,
            PrintBlock.Text("Conexion Bluetooth OK", 24f, false),
            PrintBlock.Feed,
        ),
    )

    suspend fun printBytes(ctx: Context, bytes: ByteArray): Result<Unit> = withContext(Dispatchers.IO) {
        val session = SessionManager(ctx.applicationContext)
        val mac = session.printerMac.trim()
        if (mac.isEmpty()) {
            return@withContext Result.failure(IllegalStateException("Sin impresora: elegí una en Configuración"))
        }
        if (!isEnabled(ctx)) {
            return@withContext Result.failure(IllegalStateException("Bluetooth apagado"))
        }
        var socket: android.bluetooth.BluetoothSocket? = null
        try {
            val ad = adapter(ctx) ?: return@withContext Result.failure(IllegalStateException("Sin Bluetooth"))
            try {
                ad.cancelDiscovery()
            } catch (_: Exception) {
            }
            val device = try {
                ad.getRemoteDevice(mac)
            } catch (_: Exception) {
                return@withContext Result.failure(IllegalStateException("Dirección inválida: $mac"))
            }
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
            try {
                withTimeout(15_000) { socket.connect() }
            } catch (e: Exception) {
                return@withContext Result.failure(IllegalStateException("No se pudo conectar a ${session.printerName.ifBlank { mac }}"))
            }
            // El socket SPP tarda en estabilizarse (igual que en Flutter: 2s).
            delay(1500)
            try {
                socket.outputStream.write(bytes)
                socket.outputStream.flush()
            } catch (e: Exception) {
                return@withContext Result.failure(IllegalStateException("Error enviando datos: ${e.message}"))
            }
            delay(800)
            Result.success(Unit)
        } catch (e: SecurityException) {
            Result.failure(IllegalStateException("Sin permiso de Bluetooth"))
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {
            }
        }
    }
}
