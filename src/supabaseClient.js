import { createClient } from '@supabase/supabase-js';

// Supabase Configuration
// Defaults provided for static client deployment (GitHub Pages) with row-level security enabled
const DEFAULT_SUPABASE_URL = 'https://xidziesuwreclbvtwybr.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpZHppZXN1d3JlY2xidnR3eWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNzY4NDYsImV4cCI6MjEwNjk1Mjg0Nn0.Oq2uDL4NvKQzWz4a5WDgYUjW8M08Gpnj9kHcaySMkS0';

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || '').trim();

// Ensure clean base URL without trailing slash or /rest/v1
if (supabaseUrl) {
  supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

