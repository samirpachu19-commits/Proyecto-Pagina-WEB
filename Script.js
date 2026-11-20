// ---------- PRODUCTOS DESDE LA BASE DE DATOS ----------

function escaparHTML(texto) {
    return String(texto ?? '').replace(/[&<>"'`]/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
    }[c]));
}

function crearTarjeta(producto) {
    const precio = `$${Number(producto.precio).toLocaleString('en-US')}`;
    return `
        <div class="swiper-slide">
            <article class="platillo">
                <div class="platillo-img">
                    <img src="${escaparHTML(producto.imagen)}" alt="${escaparHTML(producto.nombre)}">
                </div>
                <h3>${escaparHTML(producto.nombre)}</h3>
                <p class="platillo-desc">${escaparHTML(producto.descripcion)}</p>
                <div class="platillo-footer">
                    <p class="precio">${precio} <span>/ ${escaparHTML(producto.unidad_venta)}</span></p>
                    <a href="#" class="agregar-carrito btn-2" data-id="${producto.id_producto}">Agregar</a>
                </div>
            </article>
        </div>`;
}

const SECCIONES_PRODUCTOS = [
    { unidad: 'plato', selector: '#lista', vacio: 'No hay platos disponibles por ahora.' },
    { unidad: 'kg', selector: '#lista-2', vacio: 'No hay cortes disponibles por ahora.' },
];
const INTERVALO_PRODUCTOS_MS = 10000;
const CANAL_PRODUCTOS = 'beef-productos';

const firmasSecciones = new Map();
const slidersActivos = new Map();
let consultandoProductos = false;
let repetirConsulta = false;

function pintarSeccionProductos({ selector, vacio }, productos) {
    const firma = JSON.stringify(productos);
    if (firmasSecciones.get(selector) === firma) return;
    firmasSecciones.set(selector, firma);

    const seccion = document.querySelector(selector);
    const slider = seccion?.querySelector('.mySwiper');
    const contenedor = slider?.querySelector('.swiper-wrapper');
    if (!contenedor) return;

    slidersActivos.get(slider)?.destroy(true, true);
    slidersActivos.delete(slider);
    slider.querySelectorAll('.swiper-button-next, .swiper-button-prev').forEach((flecha) => {
        flecha.classList.remove('swiper-button-lock', 'swiper-button-disabled');
        flecha.removeAttribute('aria-disabled');
    });
    slider.querySelector('.swiper-pagination')?.classList.remove('swiper-pagination-lock');

    contenedor.innerHTML = productos.map(crearTarjeta).join('');

    seccion.querySelector('.sin-productos-texto')?.remove();
    seccion.classList.toggle('sin-productos', !productos.length);
    if (!productos.length) {
        seccion.insertAdjacentHTML('beforeend', `<p class="sin-productos-texto">${vacio}</p>`);
    }

    iniciarSlider(slider);
}

async function cargarProductos() {
    if (consultandoProductos) {
        repetirConsulta = true;
        return;
    }
    consultandoProductos = true;

    try {
        const respuesta = await fetch('/api/productos', { cache: 'no-store' });
        const datos = await respuesta.json();
        if (!datos.ok) throw new Error(datos.error);

        SECCIONES_PRODUCTOS.forEach((seccion) => {
            pintarSeccionProductos(seccion, datos.productos.filter((p) => p.unidad_venta === seccion.unidad));
        });
        sincronizarCarrito(datos.productos);
        actualizarCortesDeRecetas(datos.productos);
    } catch (error) {
        console.warn('No se pudieron cargar los productos de la base de datos:', error);
    } finally {
        consultandoProductos = false;
    }

    if (repetirConsulta) {
        repetirConsulta = false;
        await cargarProductos();
    }
}

function vigilarCambiosDeProductos() {
    setInterval(() => {
        if (!document.hidden) cargarProductos();
    }, INTERVALO_PRODUCTOS_MS);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) cargarProductos();
    });

    if ('BroadcastChannel' in window) {
        new BroadcastChannel(CANAL_PRODUCTOS).addEventListener('message', cargarProductos);
    }
}

cargarProductos().then(() => {
    document.querySelectorAll('.platillos.cargando').forEach((s) => s.classList.remove('cargando'));
    document.querySelectorAll('.mySwiper').forEach((slider) => {
        if (!slidersActivos.has(slider)) iniciarSlider(slider);
    });
    vigilarCambiosDeProductos();
});

function iniciarSlider(slider) {
    const totalProductos = slider.querySelectorAll('.swiper-slide').length;
    if (!totalProductos) return;

    slidersActivos.set(slider, new Swiper(slider, {
        slidesPerView: 1,
        spaceBetween: 30,
        speed: 250,
        loop: totalProductos > 3,
        centerInsufficientSlides: true,
        loopFillGroupWithBlank: true,
        navigation: {
            nextEl: slider.querySelector(".swiper-button-next"),
            prevEl: slider.querySelector(".swiper-button-prev"),
        },
        pagination: {
            el: slider.querySelector(".swiper-pagination"),
            clickable: true,
        },
        breakpoints: {
            768: {
                slidesPerView: 2,
            },
            1024: {
                slidesPerView: 3,
            },
        },
    }));
}

const carrito = document.getElementById('carrito');
const elementos = document.getElementById('lista');
const elementos2 = document.getElementById('lista-2');
const lista = document.querySelector('#lista-carrito tbody');
const vaciarCarritoBtn = document.getElementById('vaciar-carrito');
const totalCarrito = document.getElementById('total-carrito');
const STORAGE_KEY = 'carrito-productos';

cargarEventListener();

function cargarEventListener() {
    if (elementos) elementos.addEventListener('click', comprarElemento);
    if (elementos2) elementos2.addEventListener('click', comprarElemento);
    if (carrito) carrito.addEventListener('click', manejarAccionesCarrito);
    if (vaciarCarritoBtn) vaciarCarritoBtn.addEventListener('click', vaciarCarrito);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', leerLocalStorage);
    } else {
        leerLocalStorage();
    }
}

function comprarElemento(e) {
    e.preventDefault();

    const boton = e.target.closest('.agregar-carrito');
    if (!boton) return;

    const contenedor = boton.closest('.producto, article, li, .card, .platillo');
    const elemento = contenedor || boton.parentElement?.parentElement;
    if (!elemento) return;

    const infoElemento = leerDatosElemento(elemento);
    if (!infoElemento) return;

    insertarCarrito(infoElemento);
    mostrarAvisoCarrito(infoElemento);
}

function leerDatosElemento(elemento) {
    const imagen = elemento.querySelector('img');
    const titulo = elemento.querySelector('h3, .titulo, .card-title');
    const precio = elemento.querySelector('.precio');
    const boton = elemento.querySelector('.agregar-carrito');

    if (!imagen || !titulo || !precio || !boton) return null;

    return {
        imagen: imagen.src,
        titulo: titulo.textContent.trim(),
        precio: precio.textContent.trim(),
        id: boton.dataset.id || `prod-${Date.now()}`,
        cantidad: 1,
    };
}

function parsearPrecio(precio) {
    const valor = String(precio ?? '').trim();
    const valorLimpio = valor.replace(/[^0-9,.-]/g, '');

    if (!valorLimpio) return 0;

    if (valorLimpio.includes('.') && valorLimpio.includes(',')) {
        return Number(valorLimpio.replace(/\./g, '').replace(',', '.')) || 0;
    }

    if (valorLimpio.includes(',')) {
        return Number(valorLimpio.replace(/,/g, '')) || 0;
    }

    if (valorLimpio.includes('.')) {
        return Number(valorLimpio.replace(/\./g, '')) || 0;
    }

    return Number(valorLimpio) || 0;
}

function formatearPrecio(valor) {
    const valorFormateado = new Intl.NumberFormat('es-CO', {
        maximumFractionDigits: 0,
    }).format(valor);

    return `COP $${valorFormateado}`;
}

function obtenerElementoLocalStorage() {
    try {
        const elementos = localStorage.getItem(STORAGE_KEY);
        return elementos ? JSON.parse(elementos) : [];
    } catch (error) {
        return [];
    }
}

function guardarElementoLocalStorage(elementos) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(elementos));
}

function actualizarTotalCarrito(productos) {
    if (!totalCarrito) return;

    const total = productos.reduce((acumulador, producto) => {
        const precio = parsearPrecio(producto.precio);
        const cantidad = Number(producto.cantidad) || 1;
        return acumulador + precio * cantidad;
    }, 0);

    totalCarrito.textContent = formatearPrecio(total);
}

function renderizarCarrito(productos) {
    if (!lista) return;

    lista.innerHTML = '';

    productos.forEach((elemento) => {
        const fila = document.createElement('tr');
        const precioUnitario = parsearPrecio(elemento.precio);
        const cantidad = Number(elemento.cantidad) || 1;
        const subtotal = precioUnitario * cantidad;

        fila.innerHTML = `
            <td>
                <img src="${escaparHTML(elemento.imagen)}" width="100" alt="${escaparHTML(elemento.titulo)}">
            </td>
            <td>${escaparHTML(elemento.titulo)}</td>
            <td>
                <div class="cantidad-control">
                    <button type="button" class="cantidad-btn" data-accion="restar" data-id="${escaparHTML(elemento.id)}">-</button>
                    <span>${cantidad}</span>
                    <button type="button" class="cantidad-btn" data-accion="sumar" data-id="${escaparHTML(elemento.id)}">+</button>
                </div>
            </td>
            <td>${formatearPrecio(subtotal)}</td>
            <td>
                <a href="#" class="borrar" data-id="${escaparHTML(elemento.id)}">X</a>
            </td>
        `;

        lista.appendChild(fila);
    });

    actualizarTotalCarrito(productos);
}

function insertarCarrito(elemento) {
    const productos = obtenerElementoLocalStorage();
    const productoExistente = productos.find((item) => item.id === elemento.id);

    if (productoExistente) {
        productoExistente.cantidad = (Number(productoExistente.cantidad) || 1) + 1;
        productoExistente.precio = elemento.precio;
    } else {
        productos.push({ ...elemento, cantidad: 1 });
    }

    guardarElementoLocalStorage(productos);
    renderizarCarrito(productos);
}

function manejarAccionesCarrito(e) {
    e.preventDefault();

    const botonBorrar = e.target.closest('.borrar');
    if (botonBorrar) {
        const elementoId = botonBorrar.dataset.id;
        const productos = obtenerElementoLocalStorage().filter((item) => item.id !== elementoId);
        guardarElementoLocalStorage(productos);
        renderizarCarrito(productos);
        return;
    }

    const botonCantidad = e.target.closest('.cantidad-btn');
    if (!botonCantidad) return;

    const accion = botonCantidad.dataset.accion;
    const elementoId = botonCantidad.dataset.id;
    const productos = obtenerElementoLocalStorage();
    const producto = productos.find((item) => item.id === elementoId);

    if (!producto) return;

    if (accion === 'sumar') {
        producto.cantidad = (Number(producto.cantidad) || 1) + 1;
    }

    if (accion === 'restar') {
        producto.cantidad = (Number(producto.cantidad) || 1) - 1;
        if (producto.cantidad <= 0) {
            const productosActualizados = productos.filter((item) => item.id !== elementoId);
            guardarElementoLocalStorage(productosActualizados);
            renderizarCarrito(productosActualizados);
            return;
        }
    }

    guardarElementoLocalStorage(productos);
    renderizarCarrito(productos);
}

function vaciarCarrito(e) {
    if (e) e.preventDefault();
    localStorage.removeItem(STORAGE_KEY);
    renderizarCarrito([]);
    return false;
}

function leerLocalStorage() {
    renderizarCarrito(obtenerElementoLocalStorage());
}

// ---------- Ventana flotante "Agregado al carrito" ----------
const submenuCarrito = document.querySelector('.submenu');
const DURACION_AVISO_MS = 5000;
let temporizadorAviso;

function ocultarAvisoCarrito() {
    clearTimeout(temporizadorAviso);
    document.getElementById('aviso-carrito')?.classList.remove('visible');
}

function programarCierreAviso() {
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(ocultarAvisoCarrito, DURACION_AVISO_MS);
}

function abrirCarrito() {
    ocultarAvisoCarrito();
    document.querySelector('dialog[open]')?.close();
    submenuCarrito?.classList.add('abierto');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function crearAvisoCarrito() {
    const aviso = document.createElement('div');
    aviso.id = 'aviso-carrito';
    aviso.className = 'aviso-carrito';
    aviso.setAttribute('role', 'status');

    aviso.addEventListener('click', (e) => {
        if (e.target.closest('.aviso-ver')) abrirCarrito();
        if (e.target.closest('.aviso-seguir, .aviso-cerrar')) ocultarAvisoCarrito();
    });
    aviso.addEventListener('mouseenter', () => clearTimeout(temporizadorAviso));
    aviso.addEventListener('mouseleave', programarCierreAviso);

    return aviso;
}

function mostrarAvisoCarrito(elemento) {
    const productos = obtenerElementoLocalStorage();
    const cantidad = productos.find((item) => item.id === elemento.id)?.cantidad ?? 1;

    presentarAviso(`
        <button type="button" class="aviso-cerrar" aria-label="Cerrar">&times;</button>
        <div class="aviso-producto">
            <img src="${escaparHTML(elemento.imagen)}" alt="">
            <div>
                <p class="aviso-titulo">✓ Agregado al carrito</p>
                <p class="aviso-nombre">${escaparHTML(elemento.titulo)}</p>
                <p class="aviso-detalle">Cantidad: ${escaparHTML(cantidad)} · Total: ${formatearPrecio(calcularTotal(productos))}</p>
            </div>
        </div>
        <div class="aviso-acciones">
            <button type="button" class="btn-2 aviso-seguir">Seguir comprando</button>
            <button type="button" class="btn-4 aviso-ver">Ver carrito</button>
        </div>`);
}

function presentarAviso(contenido) {
    const aviso = document.getElementById('aviso-carrito') || crearAvisoCarrito();
    aviso.innerHTML = contenido;

    (document.querySelector('dialog[open]') || document.body).appendChild(aviso);

    aviso.classList.remove('visible');
    void aviso.offsetWidth;
    aviso.classList.add('visible');
    programarCierreAviso();
}

function sincronizarCarrito(productosDisponibles) {
    const carritoActual = obtenerElementoLocalStorage();
    if (!carritoActual.length) return;

    const disponibles = new Map(productosDisponibles.map((p) => [String(p.id_producto), p]));
    const quitados = carritoActual.filter((item) => !disponibles.has(String(item.id)));
    let huboCambios = quitados.length > 0;

    const actualizado = carritoActual
        .filter((item) => disponibles.has(String(item.id)))
        .map((item) => {
            const producto = disponibles.get(String(item.id));
            const imagen = producto.imagen || item.imagen;
            if (parsearPrecio(item.precio) === producto.precio && item.imagen === imagen) return item;
            huboCambios = true;
            return { ...item, imagen, precio: `${precioTexto(producto.precio)} / ${producto.unidad_venta}` };
        });

    if (!huboCambios) return;

    guardarElementoLocalStorage(actualizado);
    renderizarCarrito(actualizado);

    if (dialogoPedido?.open) {
        if (actualizado.length) {
            document.getElementById('pedido-total').textContent = formatearPrecio(calcularTotal(actualizado));
        } else {
            dialogoPedido.close();
        }
    }

    if (quitados.length) {
        const nombres = quitados.map((item) => escaparHTML(item.titulo)).join(', ');
        const detalle = quitados.length === 1
            ? 'Ya no está disponible y se quitó de tu carrito.'
            : 'Ya no están disponibles y se quitaron de tu carrito.';
        presentarAviso(`
            <button type="button" class="aviso-cerrar" aria-label="Cerrar">&times;</button>
            <div class="aviso-producto">
                <div>
                    <p class="aviso-titulo">Carrito actualizado</p>
                    <p class="aviso-nombre">${nombres}</p>
                    <p class="aviso-detalle">${detalle}</p>
                </div>
            </div>`);
    }
}

document.addEventListener('click', (e) => {
    if (!submenuCarrito?.classList.contains('abierto')) return;
    if (e.composedPath().includes(submenuCarrito) || e.target.closest('#aviso-carrito')) return;
    submenuCarrito.classList.remove('abierto');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') submenuCarrito?.classList.remove('abierto');
});


// ---------- HACER PEDIDO ----------
const WHATSAPP_BEEF = '573142170438';
const enlaceWhatsApp = document.getElementById('pedido-whatsapp');
const dialogoPedido = document.getElementById('dialogo-pedido');
const formPedido = document.getElementById('form-pedido');
const mensajePedido = document.getElementById('pedido-mensaje');
const tipoEntrega = document.getElementById('tipo-entrega');
const camposDireccion = document.getElementById('campos-direccion');

function mostrarMensaje(elemento, texto, tipo) {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.className = `form-mensaje ${tipo || ''}`;
}

function calcularTotal(productos) {
    return productos.reduce((total, p) => total + parsearPrecio(p.precio) * (Number(p.cantidad) || 1), 0);
}

function actualizarCamposDireccion() {
    const esDomicilio = tipoEntrega.value === 'domicilio';
    camposDireccion.style.display = esDomicilio ? '' : 'none';
    formPedido.direccion.required = esDomicilio;
}

document.getElementById('hacer-pedido')?.addEventListener('click', () => {
    const productos = obtenerElementoLocalStorage();
    if (productos.length === 0) {
        alert('Tu carrito está vacío. Agrega algún plato o corte primero.');
        return;
    }
    document.getElementById('pedido-total').textContent = formatearPrecio(calcularTotal(productos));
    mostrarMensaje(mensajePedido, '');
    if (enlaceWhatsApp) enlaceWhatsApp.hidden = true;
    document.getElementById('enviar-pedido').hidden = false;
    actualizarCamposDireccion();
    submenuCarrito?.classList.remove('abierto');
    dialogoPedido.showModal();
});

document.getElementById('cerrar-pedido')?.addEventListener('click', () => dialogoPedido.close());
tipoEntrega?.addEventListener('change', actualizarCamposDireccion);

formPedido?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const productos = obtenerElementoLocalStorage();
    const campos = new FormData(formPedido);
    const boton = document.getElementById('enviar-pedido');

    const pedido = {
        cliente: {
            nombre: campos.get('nombre'),
            apellido: campos.get('apellido'),
            correo: campos.get('correo'),
            telefono: campos.get('telefono'),
            direccion: campos.get('direccion'),
            ciudad: campos.get('ciudad'),
        },
        tipo_entrega: campos.get('tipo_entrega'),
        metodo_pago: campos.get('metodo_pago'),
        observaciones: campos.get('observaciones'),
        sitio_web: campos.get('sitio_web'),
        autoriza_datos: campos.get('autoriza_datos') === 'on',
        items: productos.map((p) => ({ id: Number(p.id), cantidad: Number(p.cantidad) || 1 })),
    };

    const textoOpcion = (nombre) => formPedido.elements[nombre]?.selectedOptions?.[0]?.text || '';
    const resumen = {
        nombre: `${campos.get('nombre') || ''} ${campos.get('apellido') || ''}`.trim(),
        telefono: campos.get('telefono') || '',
        tipo: campos.get('tipo_entrega'),
        entrega: textoOpcion('tipo_entrega'),
        direccion: [campos.get('direccion'), campos.get('ciudad')].filter(Boolean).join(', '),
        pago: textoOpcion('metodo_pago'),
        observaciones: campos.get('observaciones') || '',
    };

    boton.disabled = true;
    mostrarMensaje(mensajePedido, 'Enviando pedido...');

    try {
        const respuesta = await fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedido),
        });
        const datos = await respuesta.json();
        if (!datos.ok) throw new Error(datos.error);

        mostrarMensaje(
            mensajePedido,
            `¡Pedido #${datos.id_pedido} recibido! Total: ${formatearPrecio(datos.total)}. Envíanos el resumen por WhatsApp para confirmarlo.`,
            'exito'
        );
        if (enlaceWhatsApp) {
            enlaceWhatsApp.href = `https://wa.me/${WHATSAPP_BEEF}?text=${encodeURIComponent(
                mensajeWhatsApp(datos.id_pedido, datos.total, productos, resumen)
            )}`;
            enlaceWhatsApp.hidden = false;
            boton.hidden = true;
        }
        vaciarCarrito();
        formPedido.reset();
    } catch (error) {
        mostrarMensaje(mensajePedido, error.message || 'No se pudo enviar el pedido.', 'error');
    } finally {
        boton.disabled = false;
    }
});


// ---------- WhatsApp ----------
function mensajeWhatsApp(idPedido, total, productos, resumen) {
    const lineas = [`¡Hola, Beef! Quiero confirmar mi pedido #${idPedido}:`, ''];
    productos.forEach((p) => {
        const cantidad = Number(p.cantidad) || 1;
        const unidad = String(p.precio).split('/')[1]?.trim() === 'kg' ? ' kg' : '';
        const subtotal = parsearPrecio(p.precio) * cantidad;
        lineas.push(`• ${p.titulo} × ${cantidad}${unidad}: ${formatearPrecio(subtotal)}`);
    });
    lineas.push('', `Total: ${formatearPrecio(total)}`, '', `Nombre: ${resumen.nombre}`, `Teléfono: ${resumen.telefono}`);
    lineas.push(resumen.tipo === 'domicilio'
        ? `Entrega: ${resumen.entrega} (${resumen.direccion})`
        : `Entrega: ${resumen.entrega}`);
    lineas.push(`Pago: ${resumen.pago}`);
    if (resumen.observaciones) lineas.push(`Observaciones: ${resumen.observaciones}`);
    return lineas.join('\n');
}

enlaceWhatsApp?.addEventListener('click', () => setTimeout(() => dialogoPedido.close(), 600));


// ---------- FORMULARIO DE CONTACTO ----------
const formContacto = document.getElementById('form-contacto');
const mensajeContacto = document.getElementById('contacto-mensaje');

formContacto?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const campos = new FormData(formContacto);

    mostrarMensaje(mensajeContacto, 'Enviando...');

    try {
        const respuesta = await fetch('/api/contacto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: campos.get('nombre'),
                correo: campos.get('correo'),
                mensaje: campos.get('mensaje'),
                sitio_web: campos.get('sitio_web'),
                autoriza_datos: campos.get('autoriza_datos') === 'on',
            }),
        });
        const datos = await respuesta.json();
        if (!datos.ok) throw new Error(datos.error);

        mostrarMensaje(mensajeContacto, '¡Gracias! Recibimos tu mensaje.', 'exito');
        formContacto.reset();
    } catch (error) {
        mostrarMensaje(mensajeContacto, error.message || 'No se pudo enviar el mensaje.', 'error');
    }
});


document.addEventListener('click', (e) => {
    const enlace = e.target.closest('a[href="#pregunta-datos"]');
    if (!enlace) return;
    document.querySelector('dialog[open]')?.close();
    const pregunta = document.getElementById('pregunta-datos');
    if (pregunta) pregunta.open = true;
});


// ---------- RECETAS Y HORARIOS ----------
const datosRespaldo = (() => {
    try {
        return JSON.parse(document.getElementById('datos-respaldo').textContent);
    } catch (error) {
        return { recetas: [], horarios: [] };
    }
})();

let recetasCargadas = [];

async function pedirDatos(url, clave) {
    try {
        const respuesta = await fetch(url);
        const datos = await respuesta.json();
        if (!datos.ok) throw new Error(datos.error);
        return datos[clave];
    } catch (error) {
        console.warn(`No se pudo cargar ${clave} de la base de datos:`, error);
        return datosRespaldo[clave] || [];
    }
}

function textoTiempo(minutos) {
    if (minutos < 60) return `${minutos} min`;
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

function precioTexto(valor) {
    return `$${Number(valor).toLocaleString('en-US')}`;
}

// ---------- Recetas ----------
function pintarRecetas(recetas) {
    recetasCargadas = recetas;
    const grid = document.getElementById('recetas-grid');
    if (!grid) return;

    grid.innerHTML = recetas.map((r) => `
        <article class="receta">
            <div class="receta-img">
                <img src="${escaparHTML(r.imagen)}" alt="${escaparHTML(r.titulo)}" loading="lazy">
            </div>
            <div class="receta-cuerpo">
                <div class="receta-meta">
                    <span>⏱ ${textoTiempo(r.tiempo_minutos)}</span>
                    <span>👥 ${r.porciones} porciones</span>
                    <span class="dificultad">${escaparHTML(r.dificultad)}</span>
                </div>
                <h3>${escaparHTML(r.titulo)}</h3>
                <p class="platillo-desc">${escaparHTML(r.descripcion)}</p>
                ${r.corte && r.corte_disponible ? `<p class="receta-corte">Corte: <b>${escaparHTML(r.corte)}</b> · ${precioTexto(r.precio_corte)} / kg</p>` : ''}
                <div class="receta-acciones">
                    <button type="button" class="btn-2 ver-receta" data-receta="${r.id_receta}">Ver receta</button>
                </div>
            </div>
        </article>`).join('');
}

function actualizarCortesDeRecetas(productosDisponibles) {
    const disponibles = new Map(productosDisponibles.map((p) => [p.id_producto, p]));
    let huboCambios = false;

    recetasCargadas.forEach((r) => {
        if (!r.id_producto) return;
        const producto = disponibles.get(r.id_producto);
        const disponible = Boolean(producto);
        const precio = producto ? producto.precio : r.precio_corte;
        if (r.corte_disponible === disponible && r.precio_corte === precio) return;

        r.corte_disponible = disponible;
        r.precio_corte = precio;
        huboCambios = true;
        if (!disponible) {
            document.querySelector(`.receta-comprar[data-producto="${r.id_producto}"]`)?.remove();
        }
    });

    if (huboCambios) pintarRecetas(recetasCargadas);
}

function abrirReceta(id) {
    const r = recetasCargadas.find((receta) => receta.id_receta === Number(id));
    const dialogo = document.getElementById('dialogo-receta');
    if (!r || !dialogo) return;

    document.getElementById('receta-contenido').innerHTML = `
        <div class="dialogo-header">
            <span class="header-tag" style="margin:0">Receta</span>
            <button type="button" class="dialogo-cerrar" id="cerrar-receta" aria-label="Cerrar">&times;</button>
        </div>
        <div class="receta-detalle-top">
            <img src="${escaparHTML(r.imagen)}" alt="${escaparHTML(r.titulo)}">
            <div>
                <h3>${escaparHTML(r.titulo)}</h3>
                <div class="receta-meta">
                    <span>⏱ ${textoTiempo(r.tiempo_minutos)}</span>
                    <span>👥 ${r.porciones} porciones</span>
                    <span class="dificultad">${escaparHTML(r.dificultad)}</span>
                </div>
                <p>${escaparHTML(r.descripcion)}</p>
            </div>
        </div>
        <div class="receta-columnas">
            <div>
                <h4>Ingredientes</h4>
                <ul>${r.ingredientes.map((i) => `<li>${escaparHTML(i)}</li>`).join('')}</ul>
            </div>
            <div>
                <h4>Preparación</h4>
                <ol>${r.pasos.map((p) => `<li>${escaparHTML(p)}</li>`).join('')}</ol>
            </div>
        </div>
        ${r.corte && r.corte_disponible ? `
        <div class="receta-comprar" data-producto="${r.id_producto}">
            <p>Prepárala con nuestro <b>${escaparHTML(r.corte)}</b> · ${precioTexto(r.precio_corte)} / kg</p>
            <button type="button" class="btn-4" id="comprar-corte">Agregar 1 kg al carrito</button>
        </div>` : ''}`;

    document.getElementById('cerrar-receta').addEventListener('click', () => dialogo.close());

    const botonComprar = document.getElementById('comprar-corte');
    if (botonComprar) {
        botonComprar.addEventListener('click', () => {
            const corte = {
                imagen: new URL(r.imagen_corte, location.href).href,
                titulo: r.corte,
                precio: `${precioTexto(r.precio_corte)} / kg`,
                id: String(r.id_producto),
                cantidad: 1,
            };
            insertarCarrito(corte);
            mostrarAvisoCarrito(corte);
            botonComprar.textContent = '✓ Agregado al carrito';
            botonComprar.disabled = true;
        });
    }

    dialogo.showModal();
}

document.getElementById('recetas-grid')?.addEventListener('click', (e) => {
    const boton = e.target.closest('.ver-receta');
    if (boton) abrirReceta(boton.dataset.receta);
});

document.getElementById('dialogo-receta')?.addEventListener('click', (e) => {
    if (e.target.id === 'dialogo-receta') e.target.close();
});

// ---------- Horarios ----------
let horariosCargados = [];

function formatoHora(hora) {
    const [h, m] = hora.split(':').map(Number);
    const sufijo = h < 12 ? 'a. m.' : 'p. m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

function minutosDe(hora) {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
}

function diaHoy() {
    const dia = new Date().getDay();
    return dia === 0 ? 7 : dia;
}

function pintarHorarios(horarios) {
    horariosCargados = horarios;
    const lista = document.getElementById('horarios-lista');
    if (!lista) return;
    const hoy = diaHoy();

    lista.innerHTML = horarios.map((h) => `
        <li class="${h.dia_semana === hoy ? 'hoy' : ''}">
            <span>${escaparHTML(h.nombre_dia)}${h.dia_semana === hoy ? ' (hoy)' : ''}</span>
            <span>${h.cerrado || !h.hora_apertura ? 'Cerrado' : `${formatoHora(h.hora_apertura)} – ${formatoHora(h.hora_cierre)}`}</span>
        </li>`).join('');

    actualizarEstadoLocal();
}

function actualizarEstadoLocal() {
    const estado = document.getElementById('estado-local');
    if (!estado || !horariosCargados.length) return;

    const ahora = new Date();
    const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
    const hoy = horariosCargados.find((h) => h.dia_semana === diaHoy());
    const abiertoHoy = hoy && !hoy.cerrado && hoy.hora_apertura;

    if (abiertoHoy && minutosAhora >= minutosDe(hoy.hora_apertura) && minutosAhora < minutosDe(hoy.hora_cierre)) {
        estado.className = 'estado-local abierto';
        estado.textContent = `Abierto ahora · cerramos a las ${formatoHora(hoy.hora_cierre)}`;
        return;
    }

    estado.className = 'estado-local cerrado';
    if (abiertoHoy && minutosAhora < minutosDe(hoy.hora_apertura)) {
        estado.textContent = `Cerrado ahora · abrimos hoy a las ${formatoHora(hoy.hora_apertura)}`;
        return;
    }

    for (let i = 1; i <= 7; i++) {
        const dia = ((diaHoy() - 1 + i) % 7) + 1;
        const h = horariosCargados.find((x) => x.dia_semana === dia);
        if (h && !h.cerrado && h.hora_apertura) {
            const cuando = i === 1 ? 'mañana' : `el ${h.nombre_dia.split(' ')[0].toLowerCase()}`;
            estado.textContent = `Cerrado ahora · abrimos ${cuando} a las ${formatoHora(h.hora_apertura)}`;
            return;
        }
    }
    estado.textContent = 'Cerrado';
}

async function cargarRecetasYHorarios() {
    const [recetas, horarios] = await Promise.all([
        pedirDatos('/api/recetas', 'recetas'),
        pedirDatos('/api/horarios', 'horarios'),
    ]);
    pintarRecetas(recetas);
    pintarHorarios(horarios);
    setInterval(actualizarEstadoLocal, 60000);
}

cargarRecetasYHorarios();
