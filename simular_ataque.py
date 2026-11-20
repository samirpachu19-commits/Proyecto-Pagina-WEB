import http.client
import json
import random
import socket
import sys
import time
from urllib.parse import urlparse

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except AttributeError:
    pass

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5000"

if urlparse(URL).hostname not in ("localhost", "127.0.0.1"):
    sys.exit("Este simulador solo funciona contra tu propia página en localhost.")

resultados = []
_destino = urlparse(URL)
HOST, PUERTO = "127.0.0.1", _destino.port or 80
ip_atacante = None


def nueva_ip():
    global ip_atacante
    ip = f"127.{random.randint(1, 250)}.{random.randint(1, 250)}.{random.randint(2, 250)}"
    try:
        prueba_socket = socket.socket()
        prueba_socket.bind((ip, 0))
        prueba_socket.close()
        ip_atacante = ip
    except OSError:
        ip_atacante = None


def peticion(metodo, ruta, cuerpo=None, encabezados=None, crudo=None, ip=False):
    datos = crudo if crudo is not None else (json.dumps(cuerpo).encode() if cuerpo is not None else None)
    enc = {"Content-Type": "application/json"} if cuerpo is not None else {}
    enc.update(encabezados or {})
    enc.setdefault("Host", _destino.netloc)
    origen = ip_atacante if ip is False else ip
    try:
        con = http.client.HTTPConnection(HOST, PUERTO, timeout=15,
                                         source_address=(origen, 0) if origen else None)
        con.request(metodo, ruta, body=datos, headers=enc)
        r = con.getresponse()
        respuesta = (r.status, r.read().decode("utf-8", "replace"), dict(r.getheaders()))
        con.close()
        return respuesta
    except OSError:
        return 0, "", {}


def prueba(nombre, ataque, defendido, detalle=""):
    resultados.append(defendido)
    marca = "✅ DEFENDIDO " if defendido else "❌ VULNERABLE"
    print(f"  {marca} | {nombre}")
    print(f"               ataque: {ataque}")
    if detalle:
        print(f"               resultado: {detalle}")


def titulo(texto):
    nueva_ip()
    print(f"\n── {texto} " + "─" * max(0, 60 - len(texto)))
    if ip_atacante:
        print(f"   (atacando desde la IP local {ip_atacante})")


print("=" * 66)
print("  SIMULADOR DE ATAQUES — Página Beef")
print(f"  Objetivo: {URL}")
print("=" * 66)

codigo, _, _ = peticion("GET", "/", ip=None)
if codigo == 0:
    sys.exit("\nNo se pudo conectar. ¿Está prendido el servidor (iniciar_servidor.bat)?")
if codigo == 403:
    sys.exit("\nTu IP está bloqueada de una prueba anterior. Reinicia el servidor y vuelve a ejecutar.")
nueva_ip()
if not ip_atacante:
    print("\n  Aviso: este sistema no permite usar otras IP locales. Los ataques saldrán")
    print("  de tu IP normal y al final quedarás bloqueado 15 min (reinicia el servidor).")

titulo("1. Configuración del servidor")
_, _, enc = peticion("GET", "/")
faltan = [h for h in ("Content-Security-Policy", "X-Frame-Options", "X-Content-Type-Options") if h not in enc]
prueba("Encabezados de seguridad", "revisar CSP, X-Frame-Options y nosniff",
       not faltan, "todos presentes" if not faltan else f"faltan: {', '.join(faltan)}")

codigo, _, _ = peticion("GET", "/console")
prueba("Modo debug apagado", "abrir la consola de depuración de Werkzeug (/console)",
       codigo != 200, f"respondió {codigo}" + (" (¡la consola está abierta!)" if codigo == 200 else ""))

codigo, _, _ = peticion("GET", "/.clave_secreta")
prueba("Robar la clave de sesión", "descargar /.clave_secreta", codigo == 404, f"respondió {codigo}")

titulo("2. Robo de sesión del administrador")
try:
    from flask import Flask
    from flask.sessions import SecureCookieSessionInterface
    falsa = Flask("atacante")
    falsa.secret_key = "beef-clave-secreta-cambiala-2026"
    cookie = SecureCookieSessionInterface().get_signing_serializer(falsa).dumps(
        {"id_usuario": 1, "nombre": "hacker", "rol": "admin", "inicio": time.time()})
    codigo, _, _ = peticion("GET", "/api/admin/yo", encabezados={"Cookie": f"session={cookie}"})
    prueba("Cookie de admin falsificada", "fabricar una sesión de admin con la clave del código fuente",
           codigo == 401, f"respondió {codigo}" + (" (¡entró como admin!)" if codigo == 200 else ""))
except ImportError:
    print("  (se omitió: Flask no está instalado en este Python)")

codigo, _, _ = peticion("GET", "/api/admin/pedidos")
prueba("Entrar al panel sin iniciar sesión", "pedir /api/admin/pedidos sin cookie",
       codigo == 401, f"respondió {codigo}")

titulo("3. Inyección SQL")
codigo, texto, _ = peticion("POST", "/api/admin/login",
                            {"usuario": "admin' OR '1'='1' --", "contrasena": "' OR '1'='1"},
                            {"Origin": URL})
prueba("Saltarse el login con SQL", "usuario: admin' OR '1'='1' --",
       codigo in (401, 429), f"respondió {codigo} (no entró)" if codigo in (401, 429) else f"respondió {codigo}")

codigo, texto, _ = peticion("POST", "/api/estado-pedido",
                            {"id_pedido": "1 OR 1=1", "correo": "x' OR '1'='1"}, {"Origin": URL})
prueba("Ver pedidos ajenos con SQL", "id_pedido: 1 OR 1=1   correo: x' OR '1'='1",
       codigo in (400, 404, 429), f"respondió {codigo} (no mostró ningún pedido)")

titulo("4. XSS y datos manipulados")
codigo, _, _ = peticion("POST", "/api/contacto",
                        {"nombre": "Hacker", "correo": 'x"/onmouseover="alert(1)"/@b.co', "mensaje": "hola",
                         "autoriza_datos": True},
                        {"Origin": URL})
prueba("Código JavaScript escondido en el correo", 'correo: x"/onmouseover="alert(1)"/@b.co',
       codigo == 400, f"respondió {codigo} (correo rechazado)" if codigo == 400 else f"respondió {codigo}")

codigo, texto, _ = peticion("POST", "/api/pedidos", {
    "cliente": {"nombre": "a", "apellido": "b", "correo": "prueba@ataque.co", "telefono": "3001234567"},
    "tipo_entrega": "mesa", "autoriza_datos": True, "items": [{"id": 1, "cantidad": "NaN"}]}, {"Origin": URL})
prueba("Pedido con cantidad inválida (NaN)", "cantidad: NaN (rompería el total)",
       codigo == 400, f"respondió {codigo}")

codigo, texto, _ = peticion("POST", "/api/pedidos", {
    "cliente": {"nombre": "a", "apellido": "b", "correo": "prueba@ataque.co", "telefono": "3001234567"},
    "tipo_entrega": "mesa", "autoriza_datos": True, "items": [{"id": 1, "cantidad": 999999}]}, {"Origin": URL})
prueba("Pedido gigante", "cantidad: 999999", codigo == 400, f"respondió {codigo}")

titulo("5. Ataques desde otros sitios y bots")
codigo, _, _ = peticion("POST", "/api/admin/contrasena", {"actual": "x", "nueva": "Hackeado123"},
                        {"Origin": "https://sitio-malicioso.com"})
prueba("CSRF: otro sitio cambia la contraseña", "petición desde https://sitio-malicioso.com",
       codigo == 403, f"respondió {codigo}")

codigo, _, _ = peticion("POST", "/api/contacto", crudo=b"nombre=a&correo=a@b.co&mensaje=x",
                        encabezados={"Content-Type": "application/x-www-form-urlencoded", "Origin": URL})
prueba("Formulario oculto de otra página", "enviar datos como formulario HTML (no JSON)",
       codigo == 415, f"respondió {codigo}")

codigo, texto, _ = peticion("POST", "/api/contacto",
                            {"nombre": "Bot", "correo": "bot@spam.co", "mensaje": "Compra ya",
                             "sitio_web": "http://spam.com"}, {"Origin": URL})
try:
    falso = json.loads(texto).get("id_mensaje") == 0
except ValueError:
    falso = False
prueba("Bot de spam", "llenar el campo trampa invisible", falso,
       "detectado: se le respondió 'ok' sin guardar nada" if falso else f"respondió {codigo}")

titulo("6. Fuerza bruta (adivinar contraseñas)")
codigos = []
for clave in ["123456", "password", "admin", "qwerty", "beef2026", "12345678", "colombia"]:
    c, _, _ = peticion("POST", "/api/admin/login",
                       {"usuario": f"prueba_{int(time.time())}", "contrasena": clave}, {"Origin": URL})
    codigos.append(c)
    if c in (429, 403):
        break
bloqueo = codigos[-1] in (429, 403)
prueba("Probar muchas contraseñas seguidas", f"{len(codigos)} intentos: {', '.join(map(str, codigos))}",
       bloqueo, f"bloqueado en el intento {len(codigos)}" if bloqueo else "nunca lo bloqueó")

titulo("7. Inundación de peticiones (mini DoS)")
inicio = time.time()
codigos = []
for _ in range(130):
    c, _, _ = peticion("GET", "/api/horarios")
    codigos.append(c)
    if c in (429, 403):
        break
frenado = codigos[-1] in (429, 403) and len(codigos) > 1
prueba("Mandar 130 peticiones seguidas", f"{len(codigos)} peticiones en {time.time() - inicio:.1f} s",
       frenado, f"frenado en la petición {len(codigos)}" if frenado else "no se frenó")

titulo("8. Escáner de archivos + bloqueo automático")
rutas = ["/config.py", "/app.py", "/.env", "/.git/config", "/wp-admin", "/phpmyadmin",
         "/backup.sql", "/admin.php", "/registro_seguridad.log", "/../etc/passwd"]
expuestos = []
for r in rutas:
    c, _, _ = peticion("GET", r)
    if c == 200:
        expuestos.append(r)
prueba("Buscar archivos privados", f"{len(rutas)} rutas (config.py, .env, .git, .sql...)",
       not expuestos, "ninguno se pudo abrir" if not expuestos else f"¡expuestos!: {', '.join(expuestos)}")

codigo, texto, _ = peticion("GET", "/")
prueba("Bloqueo automático del atacante", "después de escanear, el atacante vuelve a entrar a la página",
       codigo == 403, "la IP del atacante quedó bloqueada 15 min" if codigo == 403 else f"respondió {codigo} (no se bloqueó)")
if ip_atacante:
    codigo, _, _ = peticion("GET", "/", ip=None)
    prueba("Los visitantes normales siguen entrando", "abrir la página desde tu IP (127.0.0.1)",
           codigo == 200, "tu navegador entra sin problema" if codigo == 200 else f"respondió {codigo}")

total, bien = len(resultados), sum(resultados)
print("\n" + "=" * 66)
print(f"  RESULTADO: {bien} de {total} ataques defendidos")
if bien == total:
    print("  🛡️  La página se defendió de todos los ataques simulados.")
else:
    print("  ⚠️  Revisa las pruebas marcadas con ❌.")
print("  Los ataques quedaron anotados en registro_seguridad.log y en el panel")
print("  (pestaña Seguridad).")
if not ip_atacante:
    print("\n  Tu IP quedó bloqueada: cierra el servidor y ábrelo otra vez para entrar.")
print("=" * 66)
