package com.mposw.entradas.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase

/** Cache genérica (catálogo JSON). La venta siempre es online. */
@Entity(tableName = "pos_cache")
data class PosCache(
    @PrimaryKey val key: String,
    val json: String,
    val updatedAt: Long = System.currentTimeMillis(),
)

/** Ventas aprobadas para "Reimprimir última" sin papel. */
@Entity(tableName = "pos_approved_sales")
data class PosApprovedSale(
    @PrimaryKey val saleId: String,
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis(),
)

@Dao
interface PosCacheDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: PosCache)

    @Query("SELECT * FROM pos_cache WHERE `key` = :key LIMIT 1")
    suspend fun byKey(key: String): PosCache?
}

@Dao
interface PosApprovedSaleDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(sale: PosApprovedSale)

    @Query("SELECT * FROM pos_approved_sales ORDER BY createdAt DESC LIMIT 1")
    suspend fun last(): PosApprovedSale?
}

/**
 * Base del modo POS. Archivo propio ("pos.db"), separado de "entradas.db":
 * no toca el esquema ni las migraciones de entradas. Se abre SOLO en modo
 * POS (los Sunmi tienen 1 GB de RAM: nada del modo inactivo se inicializa).
 */
@Database(entities = [PosCache::class, PosApprovedSale::class], version = 1, exportSchema = false)
abstract class PosDb : RoomDatabase() {
    abstract fun cache(): PosCacheDao
    abstract fun sales(): PosApprovedSaleDao

    companion object {
        const val CATALOG_KEY = "catalog"
        @Volatile private var inst: PosDb? = null
        fun get(ctx: Context): PosDb =
            inst ?: synchronized(this) {
                inst ?: Room.databaseBuilder(ctx.applicationContext, PosDb::class.java, "pos.db")
                    .build().also { inst = it }
            }
    }
}
