-- ---------- USUARIO DE BASE DE DATOS CON PERMISOS MÍNIMOS ----------

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'beef_app') THEN
        CREATE ROLE beef_app LOGIN PASSWORD 'CAMBIA_ESTA_CONTRASENA';
    END IF;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM beef_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

GRANT CONNECT ON DATABASE "Beef_db" TO beef_app;
GRANT USAGE ON SCHEMA public TO beef_app;

GRANT SELECT ON categorias, recetas, horarios TO beef_app;
GRANT SELECT ON vista_menu, vista_recetas, vista_pedidos TO beef_app;

GRANT SELECT ON productos TO beef_app;
GRANT UPDATE (precio, stock_kg, activo) ON productos TO beef_app;

GRANT SELECT, INSERT, UPDATE ON clientes, pedidos, detalle_pedido TO beef_app;
GRANT SELECT, INSERT ON mensajes_contacto TO beef_app;
GRANT UPDATE (leido) ON mensajes_contacto TO beef_app;

GRANT SELECT ON usuarios TO beef_app;
GRANT UPDATE (contrasena_hash) ON usuarios TO beef_app;

GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO beef_app;
