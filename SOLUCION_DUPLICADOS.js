// ============================================
// SOLUCIÓN PARA DUPLICADOS EN GOOGLE SHEETS
// ============================================

// PROBLEMA: Los datos aparecen dos veces en Google Sheets
// CAUSA: La línea 170-177 sincroniza el registro recién creado

// SOLUCIÓN RÁPIDA:
// Comenta las líneas 170-177 en app.js

/*
// COMENTAR ESTAS LÍNEAS (170-177):
if (webhook && supabaseRecord) {
    try {
        console.log("🔄 Sincronizando registros pendientes...");
        await syncPendingRecords(webhook);
    } catch (syncError) {
        console.warn("⚠️ Error sincronizando pendientes:", syncError);
    }
}
*/

// Y AÑADE esta variable en la línea 157:
// let supabaseSaved = false;

// Y en la línea 159, después de saveToSupabase:
// supabaseSaved = true;

// ============================================
// CÓDIGO COMPLETO CORREGIDO (líneas 151-177)
// ============================================

try {
    // PASO 1: Guardar en Supabase (Base de datos principal)
    console.log("📊 Guardando en Supabase...");
    btn.innerHTML = '<span>Guardando en base de datos...</span>';

    let supabaseRecord = null;
    let supabaseSaved = false;  // ← AÑADIR ESTA LÍNEA

    try {
        supabaseRecord = await saveToSupabase(payload);
        supabaseSaved = true;  // ← AÑADIR ESTA LÍNEA
        console.log("✅ Datos guardados en Supabase:", supabaseRecord);
    } catch (supabaseError) {
        console.warn("⚠️ Supabase no disponible, continuando con Google Sheets:", supabaseError.message);
        // Si Supabase falla, continuamos con Google Sheets
    }

    // PASO 2: Obtener webhook
    const webhook = (typeof WEBHOOK_URL !== 'undefined' ? WEBHOOK_URL : '') ||
        sessionStorage.getItem('temp_webhook') ||
        localStorage.getItem('google_sheet_webhook');

    // ← ELIMINAR TODO EL BLOQUE DE SINCRONIZACIÓN (líneas 170-177)
    // NO sincronizar aquí porque incluiría el registro recién creado

    // PASO 3: Enviar a Google Sheets (con reintentos)
    if (webhook) {
// ... el resto continúa igual
