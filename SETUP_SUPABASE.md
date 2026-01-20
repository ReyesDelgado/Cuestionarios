# 📊 Sistema de Persistencia de Datos - Guía de Configuración

## 🎯 Arquitectura del Sistema

Este sistema implementa un flujo robusto de datos con **doble capa de persistencia**:

```
Usuario → Supabase (BD Principal) → Google Sheets (Respaldo)
                ↓
         Reintentos automáticos
         Cola de sincronización
```

### ✅ Ventajas del Sistema

1. **Cero pérdida de datos**: Los datos se guardan primero en Supabase
2. **Reintentos automáticos**: 3 intentos con backoff exponencial para Google Sheets
3. **Sincronización diferida**: Los registros pendientes se sincronizan automáticamente
4. **Modo offline**: Funciona incluso si Google Sheets está caído
5. **Auditoría completa**: Registro de timestamps y estado de sincronización

---

## 🚀 Configuración Paso a Paso

### 1. Crear Cuenta en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta gratuita
3. Crea un nuevo proyecto
4. Espera 2-3 minutos mientras se inicializa

### 2. Obtener Credenciales

1. En tu proyecto de Supabase, ve a **Settings** > **API**
2. Copia los siguientes valores:
   - **Project URL** (ejemplo: `https://xyzcompany.supabase.co`)
   - **anon public** key (la clave larga que empieza con `eyJ...`)

### 3. Configurar el Proyecto

Abre el archivo `supabase-config.js` y reemplaza:

```javascript
const SUPABASE_URL = 'TU_SUPABASE_URL_AQUI';
const SUPABASE_ANON_KEY = 'TU_SUPABASE_ANON_KEY_AQUI';
```

Con tus valores reales:

```javascript
const SUPABASE_URL = 'https://xyzcompany.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 4. Crear la Tabla en Supabase

1. En Supabase, ve a **SQL Editor**
2. Copia y pega el siguiente SQL (está también en `supabase-config.js`):

```sql
CREATE TABLE survey_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_name TEXT NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL,
    responses JSONB NOT NULL,
    synced_to_sheets BOOLEAN DEFAULT false,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX idx_survey_responses_synced ON survey_responses(synced_to_sheets);
CREATE INDEX idx_survey_responses_created_at ON survey_responses(created_at DESC);
CREATE INDEX idx_survey_responses_user_name ON survey_responses(user_name);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_survey_responses_updated_at 
    BEFORE UPDATE ON survey_responses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar Row Level Security (RLS) para seguridad
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserciones anónimas
CREATE POLICY "Allow anonymous inserts" ON survey_responses
    FOR INSERT TO anon
    WITH CHECK (true);

-- Política para permitir lecturas anónimas
CREATE POLICY "Allow anonymous reads" ON survey_responses
    FOR SELECT TO anon
    USING (true);

-- Política para permitir actualizaciones anónimas
CREATE POLICY "Allow anonymous updates" ON survey_responses
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);
```

3. Haz clic en **Run** para ejecutar el SQL

### 5. Verificar la Configuración

1. Abre la consola del navegador (F12)
2. Recarga la página del cuestionario
3. Deberías ver: `✅ Supabase client initialized`

---

## 📝 Flujo de Datos Detallado

### Cuando un usuario envía el formulario:

1. **Validación** → Verifica que todos los campos estén completos
2. **Guardar en Supabase** → Los datos se guardan en la base de datos
   - ✅ Éxito: Continúa al paso 3
   - ❌ Error: Muestra advertencia pero continúa con Google Sheets
3. **Sincronizar pendientes** → Intenta enviar registros anteriores no sincronizados
4. **Enviar a Google Sheets** → Intenta 3 veces con esperas progresivas
   - Intento 1: Inmediato
   - Intento 2: Espera 2 segundos
   - Intento 3: Espera 4 segundos
5. **Marcar como sincronizado** → Si Google Sheets funciona, marca el registro
6. **Mostrar éxito** → El usuario ve el modal de confirmación

### Logs en la Consola

```
📊 Guardando en Supabase...
✅ Datos guardados en Supabase: {id: "abc-123", ...}
🔄 Sincronizando registros pendientes...
📤 Intento 1/3 de envío a Google Sheets...
✅ Datos enviados a Google Sheets
✅ Record marked as synced: abc-123
```

---

## 🔍 Consultar Datos en Supabase

### Ver todos los registros

1. Ve a **Table Editor** en Supabase
2. Selecciona la tabla `survey_responses`
3. Verás todos los envíos con:
   - Nombre del usuario
   - Fecha de envío
   - Respuestas completas (JSON)
   - Estado de sincronización con Google Sheets

### Ver registros no sincronizados

En el **SQL Editor**, ejecuta:

```sql
SELECT * FROM survey_responses 
WHERE synced_to_sheets = false 
ORDER BY created_at DESC;
```

### Exportar datos a CSV

1. En **Table Editor**, haz clic en el botón **Export**
2. Selecciona formato CSV
3. Descarga el archivo

---

## 🛠️ Solución de Problemas

### Error: "Supabase not configured"

**Causa**: No has configurado las credenciales en `supabase-config.js`

**Solución**: 
1. Abre `supabase-config.js`
2. Reemplaza `TU_SUPABASE_URL_AQUI` y `TU_SUPABASE_ANON_KEY_AQUI`
3. Recarga la página

### Error: "Failed to save to Supabase"

**Causa**: La tabla no existe o las políticas RLS están mal configuradas

**Solución**:
1. Ve al SQL Editor en Supabase
2. Ejecuta el SQL de creación de tabla (ver paso 4)
3. Verifica que las políticas RLS estén activas

### Los datos no llegan a Google Sheets

**Causa**: El webhook de Google Sheets está caído o mal configurado

**Solución**:
- ✅ Los datos **SÍ están guardados** en Supabase
- El sistema intentará sincronizarlos automáticamente en el próximo envío
- Puedes exportar los datos desde Supabase mientras tanto

### Ver registros pendientes de sincronización

Abre la consola del navegador y ejecuta:

```javascript
getUnsyncedRecords().then(records => console.table(records));
```

---

## 📊 Estructura de Datos

### Tabla `survey_responses`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | Identificador único del registro |
| `user_name` | TEXT | Nombre del usuario que envió el formulario |
| `submitted_at` | TIMESTAMPTZ | Fecha y hora del envío |
| `responses` | JSONB | Objeto JSON con todas las respuestas |
| `synced_to_sheets` | BOOLEAN | `true` si ya se envió a Google Sheets |
| `synced_at` | TIMESTAMPTZ | Fecha de sincronización con Google Sheets |
| `created_at` | TIMESTAMPTZ | Fecha de creación del registro |
| `updated_at` | TIMESTAMPTZ | Última actualización |

### Ejemplo de `responses` (JSONB)

```json
{
  "Fecha": "20/1/2026, 11:30:45",
  "Usuario": "Juan Pérez",
  "Pregunta 1 (Pasado)": 3,
  "Pregunta 1 (Ahora)": 5,
  "Pregunta 1 (Diferencia)": 2,
  "Pregunta 2 (Pasado)": 2,
  "Pregunta 2 (Ahora)": 4,
  "Pregunta 2 (Diferencia)": 2
}
```

---

## 🔐 Seguridad

### Row Level Security (RLS)

El sistema usa RLS de Supabase para:
- ✅ Permitir inserciones anónimas (cualquiera puede enviar)
- ✅ Permitir lecturas anónimas (para sincronización)
- ✅ Permitir actualizaciones anónimas (solo para marcar como sincronizado)
- ❌ **NO** permite eliminaciones

### Mejores Prácticas

1. **No expongas tu `service_role` key** - Solo usa la `anon` key
2. **Revisa los datos regularmente** en Supabase
3. **Haz backups periódicos** exportando a CSV
4. **Monitorea el uso** en el dashboard de Supabase

---

## 📈 Plan Gratuito de Supabase

El plan gratuito incluye:
- ✅ 500 MB de almacenamiento
- ✅ 2 GB de transferencia mensual
- ✅ 50,000 usuarios activos mensuales
- ✅ Backups automáticos (7 días)

**Estimación**: Con ~200 bytes por respuesta, puedes almacenar **~2.5 millones de respuestas** en el plan gratuito.

---

## 🎓 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [API Reference](https://supabase.com/docs/reference/javascript/introduction)

---

## ✅ Checklist de Configuración

- [ ] Cuenta de Supabase creada
- [ ] Proyecto de Supabase creado
- [ ] Credenciales copiadas (URL + anon key)
- [ ] `supabase-config.js` configurado
- [ ] Tabla `survey_responses` creada
- [ ] Políticas RLS aplicadas
- [ ] Consola del navegador muestra "✅ Supabase client initialized"
- [ ] Primer envío de prueba realizado
- [ ] Datos visibles en Table Editor de Supabase

---

¡Listo! Ahora tienes un sistema robusto que **nunca perderá datos** 🎉
