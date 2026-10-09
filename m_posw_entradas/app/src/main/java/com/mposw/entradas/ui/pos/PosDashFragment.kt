package com.mposw.entradas.ui.pos

import android.os.Bundle
import com.mposw.entradas.util.MoneyFormat
import android.view.GestureDetector
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
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
    private var appliedScale = ""
    private var tabMediator: TabLayoutMediator? = null

    fun payFlags() = catalogRepo.payFlags

    fun textScaleKey(): String = session.textScale
    fun textScaleFactor(): Float = when (session.textScale) {
        "S" -> 0.85f
        "L" -> 1.2f
        else -> 1.0f
    }

    fun imageHeightDp(): Int = when (session.textScale) {
        "S" -> 72
        "L" -> 120
        else -> 96
    }

    fun productsOf(categoryId: String): List<PosProduct> = catalogRepo.productsOf(categoryId)

    fun apiRoot(): String = session.apiRoot()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _b = FragmentPosDashBinding.inflate(inflater, container, false)
        return b.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        session = SessionManager(requireContext())
        catalogRepo = PosCatalogRepo(requireContext(), session)
        salesRepo = PosSalesRepo(requireContext(), session)
        appliedScale = session.textScale
        applyScaleToChrome()
        // La franja superior (dragStrip) abre el carrito con swipe-up o tap.
        // Va en una vista dedicada: la barra está tapada por hijos clicables
        // que se comerían los toques.
        val gestures = GestureDetector(requireContext(), object : GestureDetector.SimpleOnGestureListener() {
            override fun onDown(e: MotionEvent): Boolean = true

            override fun onFling(e1: MotionEvent?, e2: MotionEvent, vx: Float, vy: Float): Boolean {
                if (vy < -300) {
                    openCart()
                    return true
                }
                return false
            }

            override fun onScroll(
                e1: MotionEvent?,
                e2: MotionEvent,
                dx: Float,
                dy: Float,
            ): Boolean {
                if (dy < -60) {
                    openCart()
                    return true
                }
                return false
            }

            override fun onSingleTapUp(e: MotionEvent): Boolean {
                openCart()
                return true
            }
        })
        b.dragStrip.setOnTouchListener { _, ev -> gestures.onTouchEvent(ev) }
        b.btnPosVerCarrito.setOnClickListener { openCart() }
        b.tabCategorias.addOnTabSelectedListener(object : com.google.android.material.tabs.TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: com.google.android.material.tabs.TabLayout.Tab) = setTabWeight(tab, true)
            override fun onTabUnselected(tab: com.google.android.material.tabs.TabLayout.Tab) = setTabWeight(tab, false)
            override fun onTabReselected(tab: com.google.android.material.tabs.TabLayout.Tab) = Unit
        })
        b.btnPosConfig.setOnClickListener {
            (activity as? com.mposw.entradas.ui.MainActivity)?.openConfig()
        }
        b.btnPosPagar.setOnClickListener { pagar() }
        // Enlaza lo que haya en memoria de inmediato (la vista pudo
        // recrearse al volver de Config); la red refresca después.
        bindPages()
        loadCatalog()
        refreshTotal()
        startModeTicker()
    }

    private var ticker: kotlinx.coroutines.Job? = null

    /** Re-pregunta el modo cada 60s solo con el dash visible. */
    private fun startModeTicker() {
        ticker?.cancel()
        ticker = viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                while (true) {
                    kotlinx.coroutines.delay(60_000L)
                    try {
                        (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                    } catch (_: Exception) {
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Si cambió la escala en Config, se reaplica (las páginas no se
        // recrean solas al volver). Doble condición: comparación + dirty flag.
        if (isAdded && ::session.isInitialized &&
            (session.textScale != appliedScale || session.scaleDirty)
        ) {
            appliedScale = session.textScale
            session.scaleDirty = false
            applyScaleToChrome()
            rebuildPages()
        }
        refreshTotal()
        if (System.currentTimeMillis() - lastLoad > 5 * 60_000L) loadCatalog()
    }

    private fun applyScaleToChrome() {
        if (_b == null || !::session.isInitialized) return
        b.btnPosPagar.textSize = 15f * textScaleFactor()
        // Botón de cobro con el color del club; si no hay, queda el primario del tema.
        com.mposw.entradas.ui.BrandApplier.tintButton(session.brandColor, b.btnPosPagar)
    }

    private fun setTabWeight(tab: com.google.android.material.tabs.TabLayout.Tab?, bold: Boolean) {
        val tv = tab?.view?.getChildAt(1) as? android.widget.TextView ?: return
        tv.setTypeface(null, if (bold) android.graphics.Typeface.BOLD else android.graphics.Typeface.NORMAL)
    }

    /** Recrea las páginas para que tomen span, textos e imágenes nuevos. */
    private fun rebuildPages() {
        bindPages()
    }

    /** Enlaza el pager con las categorías en memoria (sin red). */
    private fun bindPages() {
        if (_b == null || categories.isEmpty()) return
        b.vpCategorias.adapter = object : FragmentStateAdapter(this@PosDashFragment) {
            override fun getItemCount(): Int = categories.size
            override fun createFragment(position: Int) =
                PosCategoryPageFragment.new(categories[position].id)
        }
        tabMediator?.detach()
        tabMediator = TabLayoutMediator(b.tabCategorias, b.vpCategorias) { tab, pos ->
            tab.text = categories[pos].name
        }.also { it.attach() }
        for (i in 0 until b.tabCategorias.tabCount) {
            setTabWeight(b.tabCategorias.getTabAt(i), i == b.tabCategorias.selectedTabPosition)
        }
    }

    private fun loadCatalog() {
        lifecycleScope.launch {
            try {
                val c = catalogRepo.load()
                lastLoad = System.currentTimeMillis()
                categories = c.categories ?: emptyList()
                if (!isAdded) return@launch
                bindPages()
                if (categories.isEmpty()) toast("Sin categorías activas")
            } catch (e: Exception) {
                if (!isAdded) return@launch
                if (com.mposw.entradas.data.ApiClient.isWrongMode(e)) {
                    // El servidor cambió el modo: re-resuelve y cambia de pantalla solo.
                    (activity as? com.mposw.entradas.ui.MainActivity)?.refreshMode()
                } else {
                    toast("Sin conexión y sin catálogo cacheado")
                    if (isAdded) {
                        childFragmentManager.fragments
                            .filterIsInstance<PosCategoryPageFragment>()
                            .forEach { it.showLoadError() }
                    }
                }
            }
        }
    }

    fun reloadCatalog() {
        loadCatalog()
    }

    fun onProductTap(p: PosProduct) {
        cart.add(p)
        refreshTotal()
        haptic()
        toast("${p.name} agregado")
    }

    private fun haptic() {
        if (_b == null) return
        b.btnPosPagar.performHapticFeedback(android.view.HapticFeedbackConstants.VIRTUAL_KEY)
    }

    private fun cartQty(): Map<String, Int> = cart.lines.associate { it.product.id to it.quantity }

    fun cartQtyOf(productId: String): Int = cart.lines.firstOrNull { it.product.id == productId }?.quantity ?: 0

    private fun refreshBadges() {
        if (_b == null) return
        val tag = "f" + b.vpCategorias.currentItem
        (childFragmentManager.findFragmentByTag(tag) as? PosCategoryPageFragment)?.refreshQty(cartQty())
    }

    fun refreshTotal() {
        if (_b == null) return
        val count = cart.lines.sumOf { it.quantity }
        b.btnPosPagar.isEnabled = count > 0
        b.btnPosPagar.text = when (count) {
            0 -> "Carrito vacío"
            1 -> "Cobrar · 1 ítem · ${MoneyFormat.format(cart.total)}"
            else -> "Cobrar · $count ítems · ${MoneyFormat.format(cart.total)}"
        }
        refreshBadges()
        val socio = cart.socioNombre
        b.socioBar.visibility = if (socio != null) View.VISIBLE else View.GONE
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

    fun openCart() {
        if (!isAdded) return
        if (childFragmentManager.findFragmentByTag("cart") == null) {
            PosCartSheet().show(childFragmentManager, "cart")
        }
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
        val printedOk = PosTicketRenderer.print(requireContext(), sale)
        salesRepo.saveApproved(sale.id ?: "", salesRepo.saleToJson(sale))
        salesRepo.registerCanjes(cart, sale.id ?: "")
        cart.entradaDesc?.let {
            try { salesRepo.consumeEntradaBenefit(it.benefitCode) } catch (_: Exception) {}
        }
        if (isAdded) {
            com.mposw.entradas.ui.PagoExitosoDialogFragment.new("Venta #${sale.orderNumber}", sale.total ?: "", printedOk)
                .show(childFragmentManager, "ok")
        }
        onSaleApproved()
    }

    private fun toast(msg: String) {
        if (!isAdded) return
        Toast.makeText(requireContext(), msg, Toast.LENGTH_SHORT).show()
    }

    override fun onDestroyView() {
        ticker?.cancel()
        ticker = null
        tabMediator?.detach()
        tabMediator = null
        super.onDestroyView()
        _b = null
    }
}
