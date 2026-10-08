package com.mposw.entradas.ui.pos

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.viewpager2.adapter.FragmentStateAdapter
import com.google.android.material.tabs.TabLayoutMediator
import com.mposw.entradas.data.PosCategory
import com.mposw.entradas.data.PosProduct
import com.mposw.entradas.data.SessionManager
import com.mposw.entradas.data.pos.PosCart
import com.mposw.entradas.data.pos.PosCatalogRepo
import com.mposw.entradas.data.pos.PosSalesRepo
import com.mposw.entradas.databinding.FragmentPosDashBinding
import kotlinx.coroutines.launch
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Dash del modo POS: tabs por categoría con swipe lateral, total abajo,
 * carrito slide-up y un único botón PAGAR. Al aprobar vuelve acá.
 */
class PosDashFragment : Fragment() {
    private var _b: FragmentPosDashBinding? = null
    private val b get() = _b!!
    private lateinit var session: SessionManager
    private lateinit var catalogRepo: PosCatalogRepo
    lateinit var salesRepo: PosSalesRepo
        private set
    val cart = PosCart()

    private var categories: List<PosCategory> = emptyList()
    private var lastLoad = 0L
    private val money = NumberFormat.getCurrencyInstance(Locale("es", "AR")).apply {
        maximumFractionDigits = 0
    }

    fun textScaleKey(): String = session.textScale
    fun textScaleFactor(): Float = when (session.textScale) {
        "S" -> 0.85f
        "L" -> 1.2f
        else -> 1.0f
    }

    fun productsOf(categoryId: String): List<PosProduct> = catalogRepo.productsOf(categoryId)

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentPosDashBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        catalogRepo = PosCatalogRepo(requireContext(), session)
        salesRepo = PosSalesRepo(requireContext(), session)
        b.tvPosTotal.textSize = 24f * textScaleFactor()
        b.btnPosCart.setOnClickListener { PosCartSheet().show(childFragmentManager, "cart") }
        b.btnPosPagar.setOnClickListener { pagar() }
        b.tvPosFecha.text = SimpleDateFormat("EEE dd/MM · HH:mm", Locale("es", "AR")).format(Date())
        loadCatalog()
        refreshTotal()
    }

    override fun onResume() {
        super.onResume()
        refreshTotal()
        if (System.currentTimeMillis() - lastLoad > 5 * 60_000L) loadCatalog()
    }

    private fun loadCatalog() {
        lifecycleScope.launch {
            try {
                val c = catalogRepo.load()
                lastLoad = System.currentTimeMillis()
                categories = c.categories
                if (!isAdded) return@launch
                b.vpCategorias.adapter = object : FragmentStateAdapter(this@PosDashFragment) {
                    override fun getItemCount(): Int = categories.size
                    override fun createFragment(position: Int) =
                        PosCategoryPageFragment.new(categories[position].id)
                }
                TabLayoutMediator(b.tabCategorias, b.vpCategorias) { tab, pos ->
                    tab.text = categories[pos].name
                }.attach()
                if (categories.isEmpty()) toast("Sin categorías activas")
            } catch (e: Exception) {
                if (isAdded) toast("Sin conexión y sin catálogo cacheado")
            }
        }
    }

    fun onProductTap(p: PosProduct) {
        cart.add(p)
        refreshTotal()
        toast("${p.name} agregado")
    }

    fun refreshTotal() {
        if (_b == null) return
        val count = cart.lines.sumOf { it.quantity }
        b.tvPosTotal.text = money.format(cart.total)
        b.btnPosCart.text = if (count > 0) "Ver ($count)" else "Ver"
        val socio = cart.socioNombre
        b.tvPosSocio.visibility = if (socio != null) View.VISIBLE else View.GONE
        if (socio != null) b.tvPosSocio.text = "Socio: $socio ✕"
        b.tvPosSocio.setOnClickListener { cart.clearSocio(); cart.setEntradaDesc(null); refreshTotal() }
    }

    private fun pagar() {
        if (cart.lines.isEmpty()) {
            toast("Carrito vacío")
            return
        }
        PosPaySheet().show(childFragmentManager, "pay")
    }

    /** Llamado por sheets/flujos al aprobar: limpia y vuelve al dash. */
    fun onSaleApproved() {
        cart.clear()
        if (isAdded) {
            refreshTotal()
            // Refresca páginas para stock visible (recarga liviana)
            loadCatalog()
        }
    }

    /**
     * Final común a CASH y QR aprobado: marca impreso, imprime en Sunmi,
     * guarda para reimpresión, registra canjes, consume beneficio de
     * entrada y muestra éxito. Después vuelve al dash limpio.
     */
    suspend fun finalizeApproved(sale: com.mposw.entradas.data.PosSale) {
        salesRepo.markPrinted(sale.id ?: "")
        PosTicketRenderer.print(requireContext(), sale)
        salesRepo.saveApproved(sale.id ?: "", salesRepo.saleToJson(sale))
        salesRepo.registerCanjes(cart, sale.id ?: "")
        cart.entradaDesc?.let {
            try { salesRepo.consumeEntradaBenefit(it.benefitCode) } catch (_: Exception) {}
        }
        if (isAdded) {
            com.mposw.entradas.ui.PagoExitosoDialogFragment.new("Venta #${sale.orderNumber}", sale.total ?: "")
                .show(childFragmentManager, "ok")
        }
        onSaleApproved()
    }

    private fun toast(msg: String) {
        if (!isAdded) return
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _b = null
    }
}
