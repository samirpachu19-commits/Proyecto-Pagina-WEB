// ---------- ASISTENTE VIRTUAL BEEF ----------
(() => {
    // ---------- Estructura del chat ----------
    const contenedor = document.createElement('div');
    contenedor.className = 'asis';
    contenedor.innerHTML = `
        <button type="button" class="asis-boton" id="asis-boton" aria-label="Abrir asistente virtual">
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path fill="currentColor" d="M12 3C6.5 3 2 6.6 2 11c0 2.4 1.3 4.5 3.4 6l-.9 3.5c-.1.4.3.7.7.5L9.4 19c.8.2 1.7.3 2.6.3 5.5 0 10-3.6 10-8.1S17.5 3 12 3zm-4 9.3a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/>
            </svg>
            <span class="asis-aviso" id="asis-aviso">1</span>
        </button>

        <section class="asis-panel" id="asis-panel" aria-label="Asistente virtual" hidden>
            <header class="asis-header">
                <div class="asis-avatar">B</div>
                <div>
                    <strong>Asistente Beef</strong>
                    <small><span class="asis-punto"></span><span id="asis-estado">En línea</span></small>
                </div>
                <button type="button" class="asis-cerrar" id="asis-cerrar" aria-label="Cerrar">&times;</button>
            </header>
            <div class="asis-mensajes" id="asis-mensajes" aria-live="polite"></div>
            <div class="asis-sugerencias" id="asis-sugerencias"></div>
            <form class="asis-form" id="asis-form" autocomplete="off">
                <input type="text" id="asis-input" placeholder="Pregúntame lo que quieras..." maxlength="500">
                <button type="submit" aria-label="Enviar">
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                        <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.3 10l12.6 2-12.6 2z"/>
                    </svg>
                </button>
            </form>
        </section>`;
    document.body.appendChild(contenedor);

    const panel = document.getElementById('asis-panel');
    const mensajes = document.getElementById('asis-mensajes');
    const sugerencias = document.getElementById('asis-sugerencias');
    const input = document.getElementById('asis-input');
    const aviso = document.getElementById('asis-aviso');

    const SUGERENCIAS_INICIO = ['Ver platos', 'Cortes por kilo', '¿Están abiertos?', 'Recomiéndame algo', 'Estado de mi pedido', 'Recetas'];

    let flujo = null;
    let abiertoAntes = false;

    let iaActiva = null;
    let esperandoIA = false;
    const historial = [];

    // ---------- Utilidades ----------
    const esc = (texto) => (typeof escaparHTML === 'function' ? escaparHTML(texto) : String(texto ?? ''));
    const pesos = (valor) => `$${Math.round(Number(valor) || 0).toLocaleString('es-CO')}`;

    function normalizar(texto) {
        return String(texto || '')
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[¿?¡!.,;:]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function contiene(texto, palabras) {
        const conEspacio = ` ${texto}`;
        return palabras.some((p) => conEspacio.includes(` ${p}`));
    }

    function hora12(hora) {
        return typeof formatoHora === 'function' ? formatoHora(hora) : hora;
    }

    // ---------- Mostrar mensajes ----------
    function agregarMensaje(html, quien = 'bot') {
        const burbuja = document.createElement('div');
        burbuja.className = `asis-msg asis-${quien}`;
        burbuja.innerHTML = html;
        mensajes.appendChild(burbuja);
        mensajes.scrollTop = mensajes.scrollHeight;
        if (!burbuja.querySelector('.asis-escribiendo')) recordar(quien, burbuja.innerText);
        return burbuja;
    }

    function recordar(quien, textoPlano) {
        const limpio = String(textoPlano || '').replace(/\s+/g, ' ').trim();
        if (!limpio) return;
        historial.push({ rol: quien === 'usuario' ? 'usuario' : 'asistente', texto: limpio.slice(0, 1500) });
        if (historial.length > 12) historial.shift();
    }

    function mostrarSugerencias(lista) {
        sugerencias.innerHTML = (lista || [])
            .map((s) => `<button type="button" class="asis-chip">${esc(s)}</button>`)
            .join('');
    }

    function responder(html, chips = SUGERENCIAS_INICIO) {
        const escribiendo = agregarMensaje('<span class="asis-escribiendo"><i></i><i></i><i></i></span>');
        mostrarSugerencias([]);
        setTimeout(() => {
            escribiendo.remove();
            agregarMensaje(html);
            mostrarSugerencias(chips);
        }, 450 + Math.random() * 350);
    }

    // ---------- Datos de la página ----------
    function obtenerProductos() {
        const vistos = new Map();
        document.querySelectorAll('#lista .platillo, #lista-2 .platillo').forEach((tarjeta) => {
            const boton = tarjeta.querySelector('.agregar-carrito');
            const nombre = tarjeta.querySelector('h3')?.textContent.trim();
            const precioTexto = tarjeta.querySelector('.precio')?.textContent.trim() || '';
            if (!boton || !nombre || vistos.has(boton.dataset.id)) return;
            vistos.set(boton.dataset.id, {
                id: boton.dataset.id,
                nombre,
                precioTexto,
                precio: typeof parsearPrecio === 'function' ? parsearPrecio(precioTexto) : 0,
                unidad: precioTexto.includes('kg') ? 'kg' : 'plato',
                imagen: tarjeta.querySelector('img')?.src || '',
                descripcion: tarjeta.querySelector('.platillo-desc')?.textContent.trim() || '',
            });
        });
        return [...vistos.values()];
    }

    function tarjetaProducto(p) {
        return `
            <div class="asis-producto">
                <img src="${esc(p.imagen)}" alt="">
                <div>
                    <b>${esc(p.nombre)}</b>
                    <span>${pesos(p.precio)} / ${esc(p.unidad)}</span>
                </div>
                <button type="button" class="asis-agregar" data-id="${esc(p.id)}">Agregar</button>
            </div>`;
    }

    function listaProductos(productos) {
        return `<div class="asis-productos">${productos.map(tarjetaProducto).join('')}</div>`;
    }

    // ---------- Respuestas ----------
    function respuestaHorario() {
        const horarios = typeof horariosCargados !== 'undefined' ? horariosCargados : [];
        if (!horarios.length) return 'Atendemos todos los días desde las 11:00 a. m. Revisa la sección <a href="#horarios">Horarios</a>.';

        const estado = document.getElementById('estado-local')?.textContent || '';
        const filas = horarios.map((h) =>
            `<li><span>${esc(h.nombre_dia)}</span><span>${h.cerrado ? 'Cerrado' : `${hora12(h.hora_apertura)} – ${hora12(h.hora_cierre)}`}</span></li>`
        ).join('');
        return `${estado ? `<b>${esc(estado)}</b><br>` : ''}Este es nuestro horario:<ul class="asis-horario">${filas}</ul>`;
    }

    function respuestaAbierto() {
        const estado = document.getElementById('estado-local')?.textContent;
        if (!estado) return respuestaHorario();
        const abierto = estado.toLowerCase().startsWith('abierto');
        return `${abierto ? '🟢' : '🔴'} <b>${esc(estado)}</b>${abierto ? '<br>Puedes hacer tu pedido ahora mismo desde el carrito 🛒' : ''}`;
    }

    function respuestaPlatos() {
        const platos = obtenerProductos().filter((p) => p.unidad === 'plato');
        return `Estos son nuestros platos a la parrilla 🔥${listaProductos(platos)}`;
    }

    function respuestaCortes() {
        const cortes = obtenerProductos().filter((p) => p.unidad === 'kg');
        return `Nuestros cortes frescos, con precio por kilo 🥩${listaProductos(cortes)}`;
    }

    function respuestaRecetas() {
        const recetas = typeof recetasCargadas !== 'undefined' ? recetasCargadas : [];
        if (!recetas.length) return 'Mira nuestras recetas en la sección <a href="#recetas">Recetas</a>.';
        const items = recetas.map((r) =>
            `<button type="button" class="asis-receta" data-receta="${r.id_receta}">📖 ${esc(r.titulo)}</button>`
        ).join('');
        return `Tenemos estas recetas para preparar en casa con nuestros cortes:<div class="asis-recetas">${items}</div>`;
    }

    const RECOMENDACIONES = {
        'para la parrilla': { ids: ['5', '1'], texto: 'Para la parrilla te recomiendo el <b>Ribeye</b>: tiene mucho marmoleo y queda jugoso. Si prefieres que te lo preparemos, el <b>Filet mignon</b> es el favorito.' },
        'algo magro': { ids: ['6', '2'], texto: 'Si buscas algo suave y con poca grasa, los <b>Medallones de lomo</b> son ideales. Ya preparado, prueba el <b>Lomo al ajo y romero</b>.' },
        'economico': { ids: ['8', '7'], texto: 'Las opciones con mejor precio son el <b>Lomo de aguja</b> y la <b>Chuleta de res con hueso</b>, perfectos para cocinar en casa.' },
        'coccion lenta': { ids: ['8', '7'], texto: 'Para sudados, estofados u horno, el <b>Lomo de aguja</b> y la <b>Chuleta con hueso</b> quedan muy tiernos con cocción lenta.' },
    };

    function respuestaRecomendacion(texto) {
        const clave = Object.keys(RECOMENDACIONES).find((k) => texto.includes(k))
            || (contiene(texto, ['barato', 'economic', 'precio bajo', 'poco dinero']) && 'economico')
            || (contiene(texto, ['magro', 'sin grasa', 'suave', 'saludable']) && 'algo magro')
            || (contiene(texto, ['lenta', 'sudado', 'estofado', 'horno']) && 'coccion lenta')
            || (contiene(texto, ['parrilla', 'asado', 'bbq', 'jugoso']) && 'para la parrilla');

        if (!clave) {
            return {
                html: '¡Con gusto! ¿Para qué lo quieres? 🤔',
                chips: ['Para la parrilla', 'Algo magro', 'Económico', 'Cocción lenta'],
            };
        }
        const rec = RECOMENDACIONES[clave];
        const productos = obtenerProductos().filter((p) => rec.ids.includes(p.id));
        return { html: `${rec.texto}${listaProductos(productos)}` };
    }

    function buscarProductos(texto) {
        const ignorar = ['de', 'del', 'la', 'el', 'con', 'res', 'a', 'al', 'y', 'en', 'por', 'kg'];
        return obtenerProductos().filter((p) => {
            const palabras = normalizar(p.nombre).replace(/[()]/g, ' ').split(' ')
                .filter((w) => w.length > 3 && !ignorar.includes(w));
            return palabras.some((w) => texto.includes(w));
        });
    }

    const ESTADOS = {
        pendiente: '🕐 <b>Pendiente</b>: ya lo recibimos y pronto empezamos a prepararlo.',
        preparando: '🔥 <b>En preparación</b>: nuestros parrilleros lo están preparando.',
        enviado: '🛵 <b>En camino / listo</b>: tu pedido ya salió o está listo para recoger.',
        entregado: '✅ <b>Entregado</b>. ¡Esperamos que lo hayas disfrutado!',
        cancelado: '❌ <b>Cancelado</b>. Si tienes dudas, escríbenos en Contacto.',
    };

    async function consultarPedido(idPedido, correo) {
        const escribiendo = agregarMensaje('<span class="asis-escribiendo"><i></i><i></i><i></i></span>');
        mostrarSugerencias([]);
        try {
            const respuesta = await fetch('/api/estado-pedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_pedido: idPedido, correo }),
            });
            const datos = await respuesta.json();
            escribiendo.remove();
            if (!datos.ok) throw new Error(datos.error);

            const p = datos.pedido;
            agregarMensaje(`
                Hola <b>${esc(p.nombre)}</b>, este es tu pedido <b>#${p.id_pedido}</b>:<br>
                ${ESTADOS[p.estado] || esc(p.estado)}
                <div class="asis-resumen">
                    <span>📅 ${esc(p.fecha)}</span>
                    <span>📦 ${p.productos} producto${p.productos === 1 ? '' : 's'}</span>
                    <span>💰 ${pesos(p.total)}</span>
                </div>`);
        } catch (error) {
            escribiendo.remove();
            agregarMensaje(`😕 ${esc(error.message || 'No pude consultar el pedido en este momento.')}`);
        }
        mostrarSugerencias(['Estado de mi pedido', 'Ver platos', '¿Están abiertos?']);
    }

    // ---------- Inteligencia artificial ----------
    function contextoPagina() {
        const recetas = typeof recetasCargadas !== 'undefined' ? recetasCargadas : [];
        return {
            estado_local: document.getElementById('estado-local')?.textContent || '',
            productos: obtenerProductos().map((p) => ({
                id: p.id, nombre: p.nombre, precio: p.precio, unidad: p.unidad, descripcion: p.descripcion,
            })),
            horarios: typeof horariosCargados !== 'undefined' ? horariosCargados : [],
            recetas: recetas.map((r) => ({
                id_receta: r.id_receta, titulo: r.titulo, corte: r.corte, tiempo_minutos: r.tiempo_minutos,
                porciones: r.porciones, dificultad: r.dificultad, ingredientes: r.ingredientes, pasos: r.pasos,
            })),
        };
    }

    function formatoTexto(textoIA) {
        const enLinea = (linea) => esc(linea)
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,!?:;]|$)/g, '$1<i>$2</i>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

        const bloques = [];
        let lista = null;
        String(textoIA).split('\n').forEach((lineaOriginal) => {
            const linea = lineaOriginal.trim().replace(/^#{1,6}\s+/, '');
            const vineta = linea.match(/^[-*•]\s+(.*)$/);
            const numero = linea.match(/^\d+[.)]\s+(.*)$/);
            if (vineta || numero) {
                const tipo = vineta ? 'ul' : 'ol';
                if (!lista || lista.tipo !== tipo) {
                    lista = { tipo, items: [] };
                    bloques.push(lista);
                }
                lista.items.push(enLinea((vineta || numero)[1]));
                return;
            }
            lista = null;
            if (!linea) { bloques.push(null); return; }
            const anterior = bloques[bloques.length - 1];
            if (typeof anterior === 'string') bloques[bloques.length - 1] = `${anterior}<br>${enLinea(linea)}`;
            else bloques.push(enLinea(linea));
        });

        return bloques
            .filter((b) => b !== null)
            .map((b) => (typeof b === 'string'
                ? `<p class="asis-parrafo">${b}</p>`
                : `<${b.tipo} class="asis-lista">${b.items.map((i) => `<li>${i}</li>`).join('')}</${b.tipo}>`))
            .join('');
    }

    function mostrarRespuestaIA(textoIA) {
        const productosIds = [];
        const recetasIds = [];
        let pedirPedido = false;
        let irContacto = false;

        const limpio = textoIA.replace(/\[\[\s*(producto|receta|pedido|contacto)\s*:?\s*(\d*)\s*\]\]/gi, (_, tipo, id) => {
            tipo = tipo.toLowerCase();
            if (tipo === 'producto' && id && !productosIds.includes(id)) productosIds.push(id);
            if (tipo === 'receta' && id && !recetasIds.includes(id)) recetasIds.push(id);
            if (tipo === 'pedido') pedirPedido = true;
            if (tipo === 'contacto') irContacto = true;
            return '';
        }).replace(/\n{3,}/g, '\n\n').trim();

        let html = formatoTexto(limpio);

        const todos = obtenerProductos();
        const productos = productosIds.map((id) => todos.find((p) => p.id === id)).filter(Boolean);
        if (productos.length) html += listaProductos(productos);

        const recetas = (typeof recetasCargadas !== 'undefined' ? recetasCargadas : [])
            .filter((r) => recetasIds.includes(String(r.id_receta)));
        if (recetas.length) {
            html += `<div class="asis-recetas">${recetas.map((r) =>
                `<button type="button" class="asis-receta" data-receta="${r.id_receta}">📖 ${esc(r.titulo)}</button>`
            ).join('')}</div>`;
        }

        if (irContacto) html += '<p class="asis-parrafo">📩 <a href="#contacto" class="asis-ir">Ir al formulario de Contacto</a></p>';

        if (pedirPedido) {
            flujo = 'pedido-numero';
            html += '<p class="asis-parrafo">¿Cuál es el <b>número del pedido</b>?</p>';
            agregarMensaje(html);
            mostrarSugerencias(['Cancelar']);
            return;
        }

        agregarMensaje(html || 'Mmm, no tengo una respuesta para eso 🤔');
        mostrarSugerencias(SUGERENCIAS_INICIO);
    }

    function ponerEstado(conIA) {
        document.getElementById('asis-estado').textContent = conIA ? 'En línea · con IA' : 'En línea · modo básico (sin IA)';
    }

    let ultimoAviso = '';
    function avisoIA(motivo) {
        if (!motivo || motivo === ultimoAviso) return;
        ultimoAviso = motivo;
        agregarMensaje(`⚠️ <small><b>La IA no está funcionando:</b> ${esc(motivo)}<br>Mientras tanto respondo en modo básico.</small>`);
    }

    async function revisarIA() {
        if (location.protocol === 'file:') {
            iaActiva = false;
            ponerEstado(false);
            avisoIA('Abriste el archivo Pagina.html directamente. Enciende el servidor (iniciar_servidor.bat) y entra a http://localhost:5000');
            return;
        }
        try {
            const respuesta = await fetch('/api/asistente/estado');
            const datos = await respuesta.json();
            if (!('activa' in datos)) throw new Error('ruta no encontrada');
            iaActiva = datos.activa ? true : (datos.mensaje?.includes('No hay clave') ? false : null);
            ponerEstado(datos.activa);
            if (!datos.activa) avisoIA(datos.mensaje);
        } catch (error) {
            ponerEstado(false);
            avisoIA('El servidor no tiene la ruta /api/asistente. Revisa que copiaste el app.py nuevo y reinicia el servidor.');
        }
    }

    async function preguntarIA(textoOriginal, textoNormalizado) {
        if (esperandoIA) return;
        esperandoIA = true;
        const escribiendo = agregarMensaje('<span class="asis-escribiendo"><i></i><i></i><i></i></span>');
        mostrarSugerencias([]);

        try {
            const respuesta = await fetch('/api/asistente', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mensaje: textoOriginal,
                    historial: historial.slice(0, -1),
                    contexto: contextoPagina(),
                }),
            });
            const datos = await respuesta.json().catch(() => ({ ok: false, codigo: 'sin_servidor' }));
            escribiendo.remove();

            if (datos.ok) {
                iaActiva = true;
                ponerEstado(true);
                mostrarRespuestaIA(datos.respuesta);
                return;
            }
            if (respuesta.status === 429 && !datos.codigo) {
                agregarMensaje(`⏳ ${esc(datos.error)}`);
                mostrarSugerencias(SUGERENCIAS_INICIO);
                return;
            }
            if (datos.codigo === 'sin_clave' || datos.codigo === 'sin_servidor') iaActiva = false;
            ponerEstado(false);
            if (datos.codigo === 'error_ia') avisoIA(datos.error);
            console.warn('Asistente IA no disponible:', datos.error || datos.codigo);
        } catch (error) {
            escribiendo.remove();
            iaActiva = false;
            console.warn('Asistente IA no disponible:', error);
        } finally {
            esperandoIA = false;
        }
        procesarLocal(textoNormalizado);
    }

    // ---------- Entender lo que escribe el cliente ----------
    function procesar(textoOriginal) {
        const texto = normalizar(textoOriginal);
        if (!texto) return;

        if (flujo === 'pedido-numero') {
            const numero = texto.match(/\d+/);
            if (!numero) {
                responder('Escríbeme solo el <b>número del pedido</b> (por ejemplo: 12). Aparece en el mensaje que te salió al confirmar la compra.', ['Cancelar']);
                return;
            }
            flujo = { paso: 'pedido-correo', id: Number(numero[0]) };
            responder(`Perfecto, pedido <b>#${numero[0]}</b>. Ahora escribe el <b>correo</b> con el que hiciste el pedido 📧`, ['Cancelar']);
            return;
        }
        if (flujo && flujo.paso === 'pedido-correo') {
            if (texto === 'cancelar') { flujo = null; responder('Listo, cancelado. ¿En qué más te ayudo?'); return; }
            const correo = String(textoOriginal).trim().match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
            if (!correo) {
                responder('Ese correo no parece válido. Escríbelo así: <i>nombre@correo.com</i>', ['Cancelar']);
                return;
            }
            const id = flujo.id;
            flujo = null;
            consultarPedido(id, correo[0].toLowerCase());
            return;
        }
        if (texto === 'cancelar') { flujo = null; responder('Listo. ¿En qué más te ayudo?'); return; }

        if (contiene(texto, ['estado de mi pedido', 'mi pedido', 'mi orden', 'rastrear', 'donde esta mi', 'ya viene', 'cuanto se demora mi'])
            || /pedido\s*#?\s*\d+/.test(texto)) {
            const numero = texto.match(/pedido\s*#?\s*(\d+)/);
            if (numero) {
                flujo = { paso: 'pedido-correo', id: Number(numero[1]) };
                responder(`Voy a buscar el pedido <b>#${numero[1]}</b>. Escribe el <b>correo</b> con el que lo hiciste 📧`, ['Cancelar']);
            } else {
                flujo = 'pedido-numero';
                responder('Te ayudo a revisar tu pedido 📦 ¿Cuál es el <b>número del pedido</b>?', ['Cancelar']);
            }
            return;
        }

        if (iaActiva !== false) {
            preguntarIA(textoOriginal, texto);
            return;
        }
        procesarLocal(texto);
    }

    function procesarLocal(texto) {
        if (contiene(texto, ['hola', 'buenas', 'buenos dias', 'buen dia', 'hey', 'que tal'])
            && texto.split(' ').length <= 4) {
            responder('¡Hola! 👋 Soy el asistente de <b>Beef</b>. Te puedo ayudar con el menú, precios, horarios, recetas o el estado de tu pedido. ¿Qué necesitas?');
            return;
        }

        if (contiene(texto, ['gracias', 'muy amable', 'perfecto gracias'])) {
            responder('¡Con mucho gusto! 🙌 Si necesitas algo más, aquí estoy.');
            return;
        }

        if (contiene(texto, ['chao', 'adios', 'hasta luego', 'nos vemos'])) {
            responder('¡Hasta pronto! Te esperamos en Beef 🔥');
            return;
        }

        const mencionaDia = contiene(texto, ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'festivo', 'manana', 'que hora']);
        if (!mencionaDia && contiene(texto, ['abierto', 'abiertos', 'abren', 'atienden hoy', 'estan atendiendo', 'cerrado', 'cierran'])) {
            responder(respuestaAbierto(), ['Ver horario completo', 'Ver platos', 'Domicilios']);
            return;
        }

        if (contiene(texto, ['horario', 'hora', 'dias', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo', 'festivo', 'atienden', 'hoy', 'manana'])) {
            const DIAS = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 7, festivo: 7 };
            const horarios = typeof horariosCargados !== 'undefined' ? horariosCargados : [];
            let dia = Object.keys(DIAS).find((d) => contiene(texto, [d]));
            let numero = dia ? DIAS[dia] : null;
            if (!numero && contiene(texto, ['hoy']) && typeof diaHoy === 'function') numero = diaHoy();
            if (!numero && contiene(texto, ['manana']) && typeof diaHoy === 'function') numero = (diaHoy() % 7) + 1;
            const h = horarios.find((x) => x.dia_semana === numero);
            if (h) {
                responder(h.cerrado
                    ? `El <b>${esc(h.nombre_dia.toLowerCase())}</b> estamos cerrados.`
                    : `El <b>${esc(h.nombre_dia.toLowerCase())}</b> atendemos de <b>${hora12(h.hora_apertura)}</b> a <b>${hora12(h.hora_cierre)}</b> 🕐`,
                ['Ver horario completo', '¿Están abiertos?', 'Domicilios']);
                return;
            }
            responder(respuestaHorario());
            return;
        }

        if (contiene(texto, ['domicilio', 'envio', 'envian', 'entregan', 'llevan', 'delivery', 'a domicilio'])) {
            responder('🛵 ¡Sí hacemos domicilios! Agrega tus productos al carrito, dale <b>Hacer pedido</b> y elige <b>Domicilio</b>. Recibimos domicilios hasta <b>30 minutos antes del cierre</b>. También puedes recoger en el local o comer aquí.', ['¿Están abiertos?', 'Formas de pago', 'Cómo hago un pedido']);
            return;
        }

        if (contiene(texto, ['pago', 'pagar', 'nequi', 'daviplata', 'tarjeta', 'efectivo', 'transferencia'])) {
            responder('💳 Recibimos <b>efectivo, Nequi, Daviplata, tarjeta y transferencia</b>. Eliges la forma de pago al confirmar tu pedido.', ['Cómo hago un pedido', 'Domicilios']);
            return;
        }

        if (contiene(texto, ['como hago un pedido', 'como pido', 'como compro', 'hacer un pedido', 'quiero pedir', 'como pedir', 'comprar'])
            && !buscarProductos(texto).length) {
            responder('Es muy fácil 🛒<ol class="asis-pasos"><li>Toca <b>Agregar</b> en los platos o cortes que quieras.</li><li>Abre el <b>carrito</b> (arriba a la derecha) y revisa las cantidades.</li><li>Dale <b>Hacer pedido</b>, llena tus datos y confirma.</li></ol>Te aparecerá un número de pedido para consultarlo después.', ['Ver platos', 'Cortes por kilo']);
            return;
        }

        if (contiene(texto, ['receta', 'preparar', 'cocinar', 'como hago', 'como se hace', 'como preparo'])) {
            responder(respuestaRecetas());
            return;
        }

        if (contiene(texto, ['recomienda', 'recomiendame', 'recomendacion', 'sugerencia', 'sugieres', 'que me aconsejas', 'cual es el mejor', 'para la parrilla', 'algo magro', 'economico', 'coccion lenta'])) {
            const r = respuestaRecomendacion(texto);
            responder(r.html, r.chips);
            return;
        }

        const encontrados = buscarProductos(texto);
        if (encontrados.length) {
            const detalle = encontrados.length === 1
                ? `<b>${esc(encontrados[0].nombre)}</b> cuesta <b>${pesos(encontrados[0].precio)} por ${encontrados[0].unidad}</b>.<br><small>${esc(encontrados[0].descripcion)}</small>`
                : 'Encontré estas opciones:';
            responder(`${detalle}${listaProductos(encontrados)}`);
            return;
        }

        if (contiene(texto, ['corte', 'cortes', 'kilo', 'carne cruda', 'carniceria'])) {
            responder(respuestaCortes());
            return;
        }

        if (contiene(texto, ['menu', 'plato', 'platos', 'carta', 'comer', 'almorzar', 'cenar', 'precio', 'precios', 'cuanto'])) {
            responder(respuestaPlatos(), ['Cortes por kilo', 'Recomiéndame algo', '¿Están abiertos?']);
            return;
        }

        if (contiene(texto, ['evento', 'cotizar', 'cotizacion', 'contacto', 'telefono', 'whatsapp', 'direccion', 'ubicacion', 'donde quedan', 'donde estan', 'queja', 'reclamo'])) {
            responder('📩 Para eventos, cotizaciones, ubicación o cualquier solicitud especial, escríbenos en el formulario de <a href="#contacto" class="asis-ir">Contacto</a> y te respondemos pronto.');
            return;
        }

        responder('Mmm, no estoy seguro de haberte entendido 🤔 Prueba con alguna de estas opciones, o escríbenos en <a href="#contacto" class="asis-ir">Contacto</a>.');
    }

    // ---------- Eventos ----------
    function abrir() {
        panel.hidden = false;
        contenedor.classList.add('abierto');
        aviso.style.display = 'none';
        if (!abiertoAntes) {
            abiertoAntes = true;
            const hora = new Date().getHours();
            const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
            responder(`${saludo} 👋 Soy el <b>asistente de Beef</b>. ¿En qué te puedo ayudar hoy?`);
            setTimeout(revisarIA, 900);
        }
        setTimeout(() => input.focus(), 100);
    }

    function cerrar() {
        panel.hidden = true;
        contenedor.classList.remove('abierto');
    }

    document.getElementById('asis-boton').addEventListener('click', () => (panel.hidden ? abrir() : cerrar()));
    document.getElementById('asis-cerrar').addEventListener('click', cerrar);

    document.getElementById('asis-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const texto = input.value.trim();
        if (!texto || esperandoIA) return;
        agregarMensaje(esc(texto), 'usuario');
        input.value = '';
        procesar(texto);
    });

    sugerencias.addEventListener('click', (e) => {
        const chip = e.target.closest('.asis-chip');
        if (!chip) return;
        const texto = chip.textContent;
        agregarMensaje(esc(texto), 'usuario');
        if (texto === 'Ver horario completo') { responder(respuestaHorario()); return; }
        if (texto === 'Formas de pago') { procesar('pago'); return; }
        if (texto === 'Cómo hago un pedido') { procesar('como hago un pedido'); return; }
        if (texto === 'Recomiéndame algo') { procesar('recomiendame'); return; }
        if (texto === 'Estado de mi pedido') { procesar('estado de mi pedido'); return; }
        if (texto === 'Ver platos') { responder(respuestaPlatos(), ['Cortes por kilo', 'Recomiéndame algo', '¿Están abiertos?']); return; }
        if (texto === 'Cortes por kilo') { responder(respuestaCortes(), ['Ver platos', 'Recetas', 'Recomiéndame algo']); return; }
        procesar(texto);
    });

    mensajes.addEventListener('click', (e) => {
        const agregar = e.target.closest('.asis-agregar');
        if (agregar) {
            const p = obtenerProductos().find((x) => x.id === agregar.dataset.id);
            if (p && typeof insertarCarrito === 'function') {
                insertarCarrito({ imagen: p.imagen, titulo: p.nombre, precio: p.precioTexto, id: p.id, cantidad: 1 });
                agregar.textContent = '✓ Listo';
                agregar.disabled = true;
                responder(`Agregué <b>${esc(p.nombre)}</b> a tu carrito 🛒 Cuando termines, abre el carrito y dale <b>Hacer pedido</b>.`, ['Ver platos', 'Cortes por kilo', 'Cómo hago un pedido']);
            }
            return;
        }
        const receta = e.target.closest('.asis-receta');
        if (receta && typeof abrirReceta === 'function') {
            abrirReceta(receta.dataset.receta);
            return;
        }
        if (e.target.closest('.asis-ir') && window.innerWidth < 600) cerrar();
    });
})();
