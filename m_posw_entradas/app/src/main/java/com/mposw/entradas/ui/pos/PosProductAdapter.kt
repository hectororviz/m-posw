package com.mposw.entradas.ui.pos

import android.graphics.Color
import android.view.HapticFeedbackConstants
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import coil.dispose
import coil.load
import coil.size.ViewSizeResolver
import com.mposw.entradas.data.PosProduct
import com.mposw.entradas.databinding.ItemPosProductBinding
import com.mposw.entradas.util.MoneyFormat

/** Fila de grilla: producto + cantidad actual en el carrito (0 = sin insignia). */
data class PosProductRow(val product: PosProduct, val qty: Int)

class PosProductAdapter(
    private val textScale: Float,
    private val imageHeightDp: Int,
    private val apiRoot: String,
    private val onTap: (PosProduct) -> Unit,
) : ListAdapter<PosProductRow, PosProductAdapter.Holder>(DIFF) {

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<PosProductRow>() {
            override fun areItemsTheSame(a: PosProductRow, b: PosProductRow): Boolean =
                a.product.id == b.product.id

            override fun areContentsTheSame(a: PosProductRow, b: PosProductRow): Boolean = a == b
        }
    }

    inner class Holder(val b: ItemPosProductBinding) : RecyclerView.ViewHolder(b.root) {
        init {
            b.root.setOnClickListener {
                it.performHapticFeedback(HapticFeedbackConstants.VIRTUAL_KEY)
                val i = bindingAdapterPosition
                if (i >= 0 && i < currentList.size) onTap(currentList[i].product)
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(ItemPosProductBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(h: Holder, position: Int) {
        val row = getItem(position)
        val p = row.product
        h.b.tvProdName.text = p.name
        h.b.tvProdName.textSize = 17f * textScale
        h.b.tvProdPrice.text = MoneyFormat.format(p.price)
        h.b.tvProdPrice.textSize = 19f * textScale
        h.b.mediaBox.layoutParams.height = (imageHeightDp * h.itemView.resources.displayMetrics.density).toInt()
        if (row.qty > 0) {
            h.b.tvProdBadge.visibility = View.VISIBLE
            h.b.tvProdBadge.text = if (row.qty > 99) "99+" else row.qty.toString()
        } else {
            h.b.tvProdBadge.visibility = View.GONE
        }

        val url = p.imageUrl(apiRoot)
        if (url != null) {
            showFallback(h, p, true)
            h.b.ivProd.visibility = View.VISIBLE
            h.b.ivProd.load(url) {
                size(ViewSizeResolver(h.b.ivProd))
                crossfade(100)
                listener(
                    onSuccess = { _, _ -> h.b.tvProdIcon.visibility = View.GONE },
                    onError = { _, _ ->
                        h.b.ivProd.visibility = View.GONE
                        h.b.tvProdIcon.visibility = View.VISIBLE
                    },
                )
            }
        } else {
            h.b.ivProd.dispose()
            h.b.ivProd.visibility = View.GONE
            h.b.tvProdIcon.visibility = View.VISIBLE
            showFallback(h, p, true)
        }
    }

    override fun onViewRecycled(h: Holder) {
        h.b.ivProd.dispose()
        super.onViewRecycled(h)
    }

    private fun showFallback(h: Holder, p: PosProduct, visible: Boolean) {
        val bg = try {
            Color.parseColor(p.colorHex ?: "#37474F")
        } catch (_: Exception) {
            Color.parseColor("#37474F")
        }
        h.b.tvProdIcon.setBackgroundColor(bg)
        val icon = p.iconName?.trim().orEmpty()
        h.b.tvProdIcon.text = icon.ifEmpty { p.name.trim().take(1).uppercase() }
        h.b.tvProdIcon.textSize = 36f * textScale
        if (visible) h.b.tvProdIcon.visibility = View.VISIBLE
    }
}
