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

@Entity(tableName = "approved_sales")
data class ApprovedSale(
    @PrimaryKey val saleId: String,
    val payloadJson: String,
    val createdAt: Long = System.currentTimeMillis(),
)

@Dao
interface ApprovedSaleDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(sale: ApprovedSale)

    @Query("SELECT * FROM approved_sales ORDER BY createdAt DESC LIMIT 1")
    suspend fun last(): ApprovedSale?

    @Query("SELECT * FROM approved_sales WHERE saleId = :id LIMIT 1")
    suspend fun byId(id: String): ApprovedSale?
}

@Database(entities = [ApprovedSale::class], version = 1, exportSchema = false)
abstract class AppDb : RoomDatabase() {
    abstract fun sales(): ApprovedSaleDao

    companion object {
        @Volatile private var inst: AppDb? = null
        fun get(ctx: Context): AppDb =
            inst ?: synchronized(this) {
                inst ?: Room.databaseBuilder(ctx.applicationContext, AppDb::class.java, "entradas.db")
                    .build().also { inst = it }
            }
    }
}
