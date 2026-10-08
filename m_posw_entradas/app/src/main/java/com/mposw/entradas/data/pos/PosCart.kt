package com.mposw.entradas.data.pos

import com.mposw.entradas.data.PosCanjeInput
import com.mposw.entradas.data.PosProduct
import com.mposw.entradas.data.SocioBeneficio
import kotlin.math.min
import kotlin.math.round

/** Línea de descuento calculada en el POS (réplica de recalcDiscounts web). */
data class PosDiscount(
    val titulo: String,
    val porcentaje: Double,
    val monto: Double,
    val beneficioId: String,
)

data class PosCartLine(
    val product: PosProduct,
    val quantity: Int,
)

/**
 * Carrito en memoria con descuentos de socio (port de CartContext web).
 * Prioridad: beneficios por producto, luego por categoría sobre lo no cubierto.
 */
class PosCart {
    val lines = mutableListOf<PosCartLine>()
    var socioId: Int? = null
        private set
    var socioNombre: String? = null
        private set
    var beneficios: List<SocioBeneficio> = emptyList()
        private set
    var entradaDesc: EntradaDesc? = null
        private set

    data class EntradaDesc(
        val benefitCode: String,
        val beneficioId: String,
        val nombre: String,
        val monto: Double,
    )

    val discounts: List<PosDiscount> get() = recalc()
    val subtotal: Double get() = lines.sumOf { (it.product.price) * it.quantity }
    val discountTotal: Double get() = round2(discounts.sumOf { it.monto } + (entradaDesc?.monto ?: 0.0))
    val total: Double get() = round2((subtotal - discountTotal).coerceAtLeast(0.0))

    fun add(product: PosProduct) {
        val i = lines.indexOfFirst { it.product.id == product.id }
        if (i >= 0) lines[i] = lines[i].copy(quantity = lines[i].quantity + 1)
        else lines.add(PosCartLine(product, 1))
    }

    fun setQuantity(productId: String, qty: Int) {
        val i = lines.indexOfFirst { it.product.id == productId }
        if (i < 0) return
        if (qty <= 0) lines.removeAt(i) else lines[i] = lines[i].copy(quantity = qty)
    }

    fun remove(productId: String) = setQuantity(productId, 0)

    fun setSocio(id: Int, nombre: String, beneficios: List<SocioBeneficio>) {
        socioId = id
        socioNombre = nombre
        this.beneficios = beneficios
    }

    fun clearSocio() {
        socioId = null
        socioNombre = null
        beneficios = emptyList()
    }

    fun setEntradaDesc(desc: EntradaDesc?) {
        entradaDesc = desc
    }

    fun clear() {
        lines.clear()
        clearSocio()
        entradaDesc = null
    }

    fun canjes(): List<PosCanjeInput> =
        discounts.map { PosCanjeInput(it.beneficioId, it.monto) }

    private fun recalc(): List<PosDiscount> {
        if (socioId == null) return emptyList()
        val result = mutableListOf<PosDiscount>()
        val cubiertas = mutableMapOf<String, Int>()
        // 1. Beneficios por producto (prioridad)
        for (b in beneficios.filter { it.disponible && it.productoId != null }) {
            val line = lines.find { it.product.id == b.productoId } ?: continue
            val limite = b.limiteDiario ?: line.quantity
            val unidades = min(limite, line.quantity)
            if (unidades <= 0) continue
            var desc = line.product.price * unidades * (b.porcentaje / 100.0)
            if (b.descuentoMaximo != null && desc > b.descuentoMaximo) desc = b.descuentoMaximo
            if (desc > 0) {
                cubiertas[b.productoId!!] = unidades
                result.add(PosDiscount(b.productoNombre ?: "Beneficio", b.porcentaje, round2(desc), b.id ?: ""))
            }
        }
        // 2. Beneficios por categoría (solo sobre lo no cubierto)
        for (b in beneficios.filter { it.disponible && it.productoId == null && it.categoriaId != null }) {
            var subtotalCat = 0.0
            for (line in lines) {
                if (line.product.categoryId != b.categoriaId) continue
                val disp = maxOf(0, line.quantity - (cubiertas[line.product.id] ?: 0))
                if (disp > 0) subtotalCat += line.product.price * disp
            }
            if (subtotalCat <= 0) continue
            var desc = subtotalCat * (b.porcentaje / 100.0)
            if (b.descuentoMaximo != null && desc > b.descuentoMaximo) desc = b.descuentoMaximo
            if (desc > 0) {
                result.add(PosDiscount(b.categoriaNombre ?: "Beneficio", b.porcentaje, round2(desc), b.id ?: ""))
            }
        }
        return result
    }

    private fun round2(v: Double): Double = round(v * 100) / 100
}
