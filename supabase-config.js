/**
 * SUPABASE CONFIGURATION
 * Base de datos principal para almacenamiento persistente
 */

// INSTRUCCIONES DE CONFIGURACIÓN:
// 1. Crea una cuenta en https://supabase.com
// 2. Crea un nuevo proyecto
// 3. Ve a Settings > API y copia tu URL y anon key
// 4. Reemplaza los valores de SUPABASE_URL y SUPABASE_ANON_KEY
// 5. Crea la tabla ejecutando el SQL que está al final de este archivo

const SUPABASE_URL = 'https://evhalrxeysymecfeznuf.supabase.co';
// IMPORTANTE: Usa la clave "anon public" de Settings > API, NO la "service_role"
// La clave debe empezar con "eyJ..." y ser muy larga
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2aGFscnhleXN5bWVjZmV6bnVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDY5ODIsImV4cCI6MjA4NDQyMjk4Mn0.6DivfBsIUsiXlW9rhu0SfWvLc14k66PsCWaJBFkb6Vk';

// Cliente de Supabase
let supabaseClient = null;

// Inicializar cliente de Supabase
function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase library not loaded. Please include the CDN script in index.html');
        console.log('Add this to your HTML: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
        return null;
    }

    if (!SUPABASE_URL || SUPABASE_URL === 'TU_SUPABASE_URL_AQUI') {
        console.warn('⚠️ Supabase URL not configured. Data will only be sent to Google Sheets.');
        return null;
    }

    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.length < 100) {
        console.error('❌ Supabase ANON_KEY is invalid or too short.');
        console.log('Go to Supabase > Settings > API and copy the "anon public" key (starts with eyJ...)');
        return null;
    }

    if (!supabaseClient) {
        try {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized successfully');
            console.log('📊 Project URL:', SUPABASE_URL);

            // Verificar conexión
            testSupabaseConnection();
        } catch (error) {
            console.error('❌ Error creating Supabase client:', error);
            return null;
        }
    }

    return supabaseClient;
}

// Verificar conexión a Supabase
async function testSupabaseConnection() {
    const client = supabaseClient;
    if (!client) return;

    try {
        console.log('🔍 Testing Supabase connection...');
        const { data, error } = await client
            .from('survey_responses')
            .select('count')
            .limit(1);

        if (error) {
            console.error('❌ Supabase connection test failed:', error);
            if (error.message.includes('relation') || error.message.includes('does not exist')) {
                console.error('💡 The table "survey_responses" does not exist. Please run the SQL script in Supabase SQL Editor.');
            } else if (error.message.includes('JWT') || error.message.includes('auth')) {
                console.error('💡 Authentication error. Check your ANON_KEY in supabase-config.js');
            } else if (error.message.includes('policy')) {
                console.error('💡 Row Level Security policy error. Make sure RLS policies are set up correctly.');
            }
        } else {
            console.log('✅ Supabase connection successful!');
        }
    } catch (error) {
        console.error('❌ Unexpected error testing connection:', error);
    }
}

// Guardar respuesta en Supabase
async function saveToSupabase(payload) {
    console.log('📊 saveToSupabase called with payload:', payload);

    const client = initSupabase();
    if (!client) {
        const error = new Error('Supabase not configured or initialized');
        console.error('❌', error.message);
        throw error;
    }

    try {
        console.log('📤 Attempting to insert data into Supabase...');

        // Construir el registro con columnas individuales
        const recordToInsert = {
            user_name: payload.Usuario || 'Anónimo',
            submitted_at: new Date().toISOString(),
            synced_to_sheets: false
        };

        // Mapear cada pregunta a sus columnas correspondientes
        // Formato del payload: "Pregunta X (Pasado)", "Pregunta X (Ahora)", "Pregunta X (Diferencia)"
        for (let i = 1; i <= 8; i++) {
            const preguntaKey = `Pregunta ${i}`;
            const pasadoKey = `${preguntaKey} (Pasado)`;
            const ahoraKey = `${preguntaKey} (Ahora)`;
            const diferenciaKey = `${preguntaKey} (Diferencia)`;

            if (payload[pasadoKey] !== undefined) {
                recordToInsert[`pregunta_${i}_pasado`] = payload[pasadoKey];
            }
            if (payload[ahoraKey] !== undefined) {
                recordToInsert[`pregunta_${i}_ahora`] = payload[ahoraKey];
            }
            if (payload[diferenciaKey] !== undefined) {
                recordToInsert[`pregunta_${i}_diferencia`] = payload[diferenciaKey];
            }
        }

        console.log('📝 Record to insert:', recordToInsert);

        const { data, error } = await client
            .from('survey_responses')
            .insert([recordToInsert])
            .select();

        if (error) {
            console.error('❌ Supabase insert error:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });

            // Diagnóstico específico
            if (error.message.includes('relation') || error.message.includes('does not exist')) {
                console.error('💡 SOLUTION: The table does not exist. Run the SQL script in supabase-schema.sql');
                console.error('📄 File location: supabase-schema.sql');
            } else if (error.code === '42501' || error.message.includes('policy')) {
                console.error('💡 SOLUTION: Row Level Security policy error. Check RLS policies in Supabase.');
                console.error('Run the SQL in supabase-schema.sql to set up policies correctly.');
            } else if (error.message.includes('JWT') || error.message.includes('auth')) {
                console.error('💡 SOLUTION: Invalid API key. Check SUPABASE_ANON_KEY in supabase-config.js');
            } else if (error.message.includes('column') || error.message.includes('does not exist')) {
                console.error('💡 SOLUTION: Table structure is outdated. Run supabase-schema.sql to update the table.');
            }

            throw error;
        }

        if (!data || data.length === 0) {
            console.warn('⚠️ Insert succeeded but no data returned');
            return null;
        }

        console.log('✅ Data saved to Supabase successfully!');
        console.log('📊 Saved record:', data[0]);
        return data[0];

    } catch (error) {
        console.error('❌ Exception in saveToSupabase:', error);
        throw error;
    }
}



// Marcar como sincronizado con Google Sheets
async function markAsSynced(recordId) {
    const client = initSupabase();
    if (!client) return;

    try {
        const { error } = await client
            .from('survey_responses')
            .update({
                synced_to_sheets: true,
                synced_at: new Date().toISOString()
            })
            .eq('id', recordId);

        if (error) throw error;
        console.log('✅ Record marked as synced:', recordId);
    } catch (error) {
        console.error('❌ Error marking as synced:', error);
    }
}

// Obtener registros no sincronizados
async function getUnsyncedRecords() {
    const client = initSupabase();
    if (!client) return [];

    try {
        const { data, error } = await client
            .from('survey_responses')
            .select('*')
            .eq('synced_to_sheets', false)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error fetching unsynced records:', error);
        return [];
    }
}

// Sincronizar registros pendientes con Google Sheets
async function syncPendingRecords(webhookUrl) {
    const pending = await getUnsyncedRecords();

    if (pending.length === 0) {
        console.log('✅ No pending records to sync');
        return;
    }

    console.log(`🔄 Syncing ${pending.length} pending records...`);

    for (const record of pending) {
        try {
            // Reconstruir el payload en el formato de Google Sheets
            const payload = {
                "Fecha": new Date(record.submitted_at).toLocaleString(),
                "Usuario": record.user_name
            };

            // Mapear las columnas individuales al formato del payload
            for (let i = 1; i <= 8; i++) {
                const pasado = record[`pregunta_${i}_pasado`];
                const ahora = record[`pregunta_${i}_ahora`];
                const diferencia = record[`pregunta_${i}_diferencia`];

                if (pasado !== null && pasado !== undefined) {
                    payload[`Pregunta ${i} (Pasado)`] = pasado;
                }
                if (ahora !== null && ahora !== undefined) {
                    payload[`Pregunta ${i} (Ahora)`] = ahora;
                }
                if (diferencia !== null && diferencia !== undefined) {
                    payload[`Pregunta ${i} (Diferencia)`] = diferencia;
                }
            }

            await sendToGoogleSheets(webhookUrl, payload);
            await markAsSynced(record.id);
            console.log(`✅ Synced record ${record.id}`);
        } catch (error) {
            console.error(`❌ Failed to sync record ${record.id}:`, error);
            // Continuar con el siguiente registro
        }
    }
}


/*
SQL PARA CREAR LA TABLA EN SUPABASE:
Ejecuta esto en el SQL Editor de Supabase (https://app.supabase.com/project/_/sql)

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

-- Política para permitir lecturas anónimas (opcional, ajustar según necesidad)
CREATE POLICY "Allow anonymous reads" ON survey_responses
    FOR SELECT TO anon
    USING (true);

-- Política para permitir actualizaciones anónimas (solo para marcar como sincronizado)
CREATE POLICY "Allow anonymous updates" ON survey_responses
    FOR UPDATE TO anon
    USING (true)
    WITH CHECK (true);
*/
