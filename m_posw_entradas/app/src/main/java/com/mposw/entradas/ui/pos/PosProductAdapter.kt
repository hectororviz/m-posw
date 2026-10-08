package com.mposw.entradas.ui.pos

import android.graphics.Color
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import coil.dispose
import coil.load
import com.mposw.entradas.data.PosProduct
import com.mposw.entradas.databinding.ItemPosProductBinding
import java.text.NumberFormat
import java.util.Locale

class PosProductAdapter(
    private val textScale: Float,
    private val imageHeightDp: Int,
    private val apiRoot: String,
    private val onTap: (PosProduct) -> Unit,
) : RecyclerView.Adapter<PosProductAdapter.Holder>() {
    private val fmt = NumberFormat.getCurrencyInstance(Locale("es", "AR")).apply {
        maximumFractionDigits = 0
    }

    var items: List<PosProduct> = emptyList()
        set(v) {
            field = v
            notifyDataSetChanged()
        }

    inner class Holder(val b: ItemPosProductBinding) : RecyclerView.ViewHolder(b.root) {
        init {
            b.root.setOnClickListener {
                val i = bindingAdapterPosition
                if (i >= 0 && i < items.size) onTap(items[i])
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(ItemPosProductBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun getItemCount(): Int = items.size

    override fun onBindViewHolder(h: Holder, position: Int) {
        val p = items[position]
        h.b.tvProdName.text = p.name
        h.b.tvProdName.textSize = 17f * textScale
        h.b.tvProdPrice.text = fmt.format(p.price)
        h.b.tvProdPrice.textSize = 19f * textScale
        h.b.mediaBox.layoutParams.height = (imageHeightDp * h.itemView.resources.displayMetrics.density).toInt()

        val url = p.imageUrl(apiRoot)
        if (url != null) {
            h.b.tvProdIcon.visibility = View.GONE
            h.b.ivProd.visibility = View.VISIBLE
            h.b.ivProd.load(url) {
                crossfade(true)
                listener(
                    onError = { _, _ ->
                        h.b.ivProd.visibility = View.GONE
                        h.b.tvProdIcon.visibility = View.VISIBLE
                    },
                )
            }
            showFallback(h, p, false)
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
