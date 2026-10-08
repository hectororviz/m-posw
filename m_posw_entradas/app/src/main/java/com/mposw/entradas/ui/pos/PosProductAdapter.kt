package com.mposw.entradas.ui.pos

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.mposw.entradas.data.PosProduct
import com.mposw.entradas.databinding.ItemPosProductBinding
import java.text.NumberFormat
import java.util.Locale

class PosProductAdapter(
    private val textScale: Float,
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
    }
}
