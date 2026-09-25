// =============================================
// ROAT DICTIONARY — Supabase Client
// =============================================
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xekvjnlvmcygcuszwbel.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IUNq0v7E6Dfm4FTscL9VIA_6iqZcdl_';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
