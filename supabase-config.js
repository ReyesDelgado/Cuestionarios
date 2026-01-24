/**
 * SUPABASE CONFIGURATION - SECURE MODE
 * Implementación segura con RLS, JSONB y RPC.
 */

const SUPABASE_URL = 'https://evhalrxeysymecfeznuf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2aGFscnhleXN5bWVjZmV6bnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDY5ODIsImV4cCI6MjA4NDQyMjk4Mn0.6DivfBsIUsiXlW9rhu0SfWvLc14k66PsCWaJBFkb6Vk';

let supabaseClient = null;

function initSupabase() {
    if (typeof supabase === 'undefined') return null;
    if (!supabaseClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return supabaseClient;
}

// Guardar respuesta de forma segura (RPC)
async function saveToSupabase(payload) {
    const client = initSupabase();
    if (!client) throw new Error('Supabase client not initialized');

    console.log('🔒 Secure Save: Invoking submit_survey RPC...');

    // Llamamos a la función RPC 'submit_survey'
    // Esta función devuelve un UUID (string) directamente
    const { data, error } = await client.rpc('submit_survey', { p_data: payload });

    if (error) {
        console.error('❌ Secure Insert RPC Error:', error);
        throw error;
    }

    console.log('✅ Secure Insert Success. ID:', data);

    // Devolvemos un objeto con la estructura que espera app.js ({ id: ... })
    return { id: data };
}

// Marcar como sincronizado usando RPC seguro (evita dar permisos UPDATE globales)
async function markAsSynced(recordId) {
    const client = initSupabase();
    if (!client) return;

    try {
        const { error } = await client.rpc('mark_as_synced', { row_id: recordId });

        if (error) throw error;
        console.log('✅ Secure Sync: Record marked via RPC');
    } catch (error) {
        console.error('❌ RPC Error:', error);
    }
}

// Las funciones de lectura masiva están DESACTIVADAS por seguridad (RLS bloquea SELECT)
async function getUnsyncedRecords() { return []; }
async function syncPendingRecords() {
    console.log('🔒 Legacy pending sync skipped for security compliance.');
}
