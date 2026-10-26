// ═══════════════════════════════════════════════════════════
// MyDiscipline — Winter Arc Application
// Full Neumorphic Productivity Engine with Dark/Light Themes
// ═══════════════════════════════════════════════════════════

import './style.css';
import { supabase } from './supabaseClient.js';
import { showToast } from './toast.js';
import { getDailyQuote } from './quotes.js';
import { icon, ICONS, WINTER_ARC_PRESETS } from './icons.js';
import {
  storeLocalFile,
  getLocalFile,
  removeLocalFile,
  downloadLocalFile,
  pickUserLocalDirectory,
} from './agendaStorage.js';

// ─── Theme State ───
let currentTheme = localStorage.getItem('mydiscipline_theme') || 'dark';

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mydiscipline_theme', theme);
}

function toggleTheme() {
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  renderPage();
  updateThemeButtons();
}

function updateThemeButtons() {
  document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    const isDark = currentTheme === 'dark';
    btn.innerHTML = `
      <span class="theme-toggle-icon">${icon(isDark ? 'sun' : 'moon', { size: 16 })}</span>
      <span>${isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
    `;
  });
}

// Initial theme setup
applyTheme(currentTheme);

// ─── App State ───
let currentUser = null;
let currentPage = 'dashboard';
let sidebarOpen = false;

// Habit state
let habits = [];
let habitLogs = [];

// Notes state
let notes = [];

// Pomodoro state
let pomodoroTimer = null;
let pomodoroSeconds = 25 * 60;
let pomodoroMode = 'focus'; // 'focus' | 'short' | 'long'
let pomodoroRunning = false;
let pomodoroSessions = 0;
const POMODORO_DURATIONS = {
  focus: (parseInt(localStorage.getItem('pomo_focus') || '25')) * 60,
  short: (parseInt(localStorage.getItem('pomo_short') || '5')) * 60,
  long: (parseInt(localStorage.getItem('pomo_long') || '15')) * 60,
};

// Mood state
let moods = [];

// Gym state
let gymRoutines = [];
let gymExercises = [];
let gymSessions = [];
let gymActiveWorkout = null;
let gymWorkoutTimer = null;
let gymRestTimer = null;
let gymWorkoutElapsed = 0;
let gymRestSecondsLeft = 0;
let gymTab = 'routines'; // 'routines' | 'history'

// Agenda & Academia state
let agendaSubjects = [];
let agendaTasks = [];
let agendaExams = [];
let agendaFiles = [];
let agendaTab = 'overview'; // 'overview' | 'tasks' | 'exams' | 'subjects'
let agendaFilterSubject = 'all';
let agendaFilterStatus = 'all';

// ─── Date Helpers ───
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDayName(date) {
  return date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
}

function getWeekDays() {
  const today = new Date();
  const startOfWeek = new Date(today);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  startOfWeek.setDate(startOfWeek.getDate() + diff);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function getLast90Days() {
  const days = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

// ─── Habit Day Helpers ───
function isHabitDueToday(habit) {
  const TODAY_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const todayDay = TODAY_DAYS[new Date().getDay()];
  const freq = habit.frequency || 'Diario';
  if (freq === 'Diario') return true;
  if (freq === 'L-V') return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].includes(todayDay);
  if (freq === '3x/semana') return ['Lun', 'Mié', 'Vie'].includes(todayDay);
  if (freq === 'Semanal') return todayDay === 'Lun';
  return freq.split(',').map(d => d.trim()).includes(todayDay);
}

function getInitialHabitDays(habit) {
  if (!habit) return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const freq = habit.frequency || 'Diario';
  if (freq === 'Diario') return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  if (freq === 'L-V') return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'];
  if (freq === '3x/semana') return ['Lun', 'Mié', 'Vie'];
  if (freq === 'Semanal') return ['Lun'];
  return freq.split(',').map(d => d.trim()).filter(d => d);
}

function daysToFrequency(days) {
  if (!days || days.length === 0) return 'Diario';
  if (days.length === 7) return 'Diario';
  if (days.length === 5 && ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].every(d => days.includes(d))) return 'L-V';
  return days.join(',');
}

// ─── Auth View ───
function renderAuth() {
  const app = document.getElementById('app');
  const isDark = currentTheme === 'dark';

  app.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-theme-toggle">
        <button class="theme-toggle-btn" id="auth-theme-btn" aria-label="Cambiar tema">
          <span class="theme-toggle-icon">${icon(isDark ? 'sun' : 'moon', { size: 16 })}</span>
          <span>${isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
        </button>
      </div>

      <div class="auth-card neu-raised-lg slide-up">
        <div class="auth-card__logo">
          <div class="auth-card__logo-icon">
            ${icon('snowflake', { size: 36, strokeWidth: 2.2 })}
          </div>
          <h1 class="auth-card__title">MyDiscipline</h1>
          <p class="auth-card__subtitle">Winter Arc — Rendimiento & Maestría Personal</p>
        </div>
        <div id="auth-error"></div>
        <form id="auth-form">
          <div class="neu-input-wrapper">
            <label for="auth-email">Correo electrónico</label>
            <input type="email" id="auth-email" class="neu-input" placeholder="tu@email.com" required autocomplete="email" />
          </div>
          <div class="neu-input-wrapper">
            <label for="auth-password">Contraseña</label>
            <input type="password" id="auth-password" class="neu-input" placeholder="Mínimo 6 caracteres" required minlength="6" autocomplete="current-password" />
          </div>
          <button type="submit" id="auth-submit" class="neu-btn neu-btn--primary neu-btn--lg" style="width:100%">
            Iniciar Sesión
          </button>
        </form>
        <div class="auth-card__footer">
          <span id="auth-toggle-text">¿No tienes cuenta?</span>
          <a href="#" id="auth-toggle-link">Regístrate</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('auth-theme-btn').addEventListener('click', toggleTheme);

  let isLogin = true;
  const form = document.getElementById('auth-form');
  const toggleLink = document.getElementById('auth-toggle-link');
  const toggleText = document.getElementById('auth-toggle-text');
  const submitBtn = document.getElementById('auth-submit');
  const errorDiv = document.getElementById('auth-error');

  toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    submitBtn.textContent = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
    toggleText.textContent = isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?';
    toggleLink.textContent = isLogin ? 'Regístrate' : 'Inicia sesión';
    errorDiv.innerHTML = '';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px;margin:auto"></div>';
    errorDiv.innerHTML = '';

    try {
      let result;
      if (isLogin) {
        result = await supabase.auth.signInWithPassword({ email, password });
      } else {
        result = await supabase.auth.signUp({ email, password });
      }

      if (result.error) {
        throw result.error;
      }

      if (!isLogin && result.data?.user?.identities?.length === 0) {
        errorDiv.innerHTML = '<div class="auth-error">Este correo ya está registrado.</div>';
        return;
      }

      if (isLogin) {
        showToast('¡Bienvenido al Winter Arc!', 'success');
      } else {
        showToast('¡Cuenta creada! Revisa tu correo si requiere confirmación.', 'success', 5000);
      }
    } catch (err) {
      const messages = {
        'Invalid login credentials': 'Credenciales incorrectas.',
        'User already registered': 'Este correo ya está registrado.',
        'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
      };
      errorDiv.innerHTML = `<div class="auth-error">${messages[err.message] || err.message}</div>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'Iniciar Sesión' : 'Crear Cuenta';
    }
  });
}

// ─── App Shell ───
function renderAppShell() {
  const app = document.getElementById('app');
  const userEmail = currentUser.email || '';
  const initials = userEmail.substring(0, 2).toUpperCase();
  const isDark = currentTheme === 'dark';

  app.innerHTML = `
    <button class="mobile-toggle neu-btn neu-btn--icon" id="mobile-toggle" aria-label="Abrir menú">
      ${icon('menu', { size: 20 })}
    </button>
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__brand">
          <div class="sidebar__brand-icon">
            ${icon('snowflake', { size: 22, strokeWidth: 2.2 })}
          </div>
          <span class="sidebar__brand-text">MyDiscipline</span>
        </div>

        <nav class="sidebar__nav">
          <div class="sidebar__link sidebar__link--active" data-page="dashboard">
            <span class="sidebar__link-icon">${icon('target', { size: 19 })}</span> Dashboard
          </div>
          <div class="sidebar__link" data-page="habits">
            <span class="sidebar__link-icon">${icon('snowflake', { size: 19 })}</span> Habit Tracker
          </div>
          <div class="sidebar__link" data-page="gym">
            <span class="sidebar__link-icon">${icon('dumbbell', { size: 19 })}</span> Gym & Fuerza
          </div>
          <div class="sidebar__link" data-page="agenda">
            <span class="sidebar__link-icon">${icon('academic', { size: 19 })}</span> Agenda & Academia
          </div>
          <div class="sidebar__link" data-page="notes">
            <span class="sidebar__link-icon">${icon('book', { size: 19 })}</span> Notas & Diario
          </div>
          <div class="sidebar__link" data-page="pomodoro">
            <span class="sidebar__link-icon">${icon('timer', { size: 19 })}</span> Deep Work
          </div>
          <div class="sidebar__link" data-page="mood">
            <span class="sidebar__link-icon">${icon('brain', { size: 19 })}</span> Mentalidad
          </div>
        </nav>

        <div class="sidebar__footer">
          <button class="theme-toggle-btn" id="sidebar-theme-btn" style="width:100%;justify-content:center">
            <span class="theme-toggle-icon">${icon(isDark ? 'sun' : 'moon', { size: 16 })}</span>
            <span>${isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>

          <div class="sidebar__user">
            <div class="sidebar__avatar">${initials}</div>
            <div class="sidebar__user-info">
              <div class="sidebar__user-name">${userEmail.split('@')[0]}</div>
              <div class="sidebar__user-email">${userEmail}</div>
            </div>
            <button class="neu-btn neu-btn--icon-sm" id="logout-btn" aria-label="Cerrar sesión" title="Cerrar sesión">
              ${icon('logout', { size: 16 })}
            </button>
          </div>
        </div>
      </aside>

      <main class="main-content" id="main-content">
        <!-- Dynamic Page content -->
      </main>
    </div>
  `;

  // Nav links
  document.querySelectorAll('.sidebar__link').forEach((link) => {
    link.addEventListener('click', () => {
      currentPage = link.dataset.page;
      document.querySelectorAll('.sidebar__link').forEach((l) => l.classList.remove('sidebar__link--active'));
      link.classList.add('sidebar__link--active');
      renderPage();
      closeSidebar();
    });
  });

  // Theme toggle
  document.getElementById('sidebar-theme-btn').addEventListener('click', toggleTheme);

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    showToast('Sesión cerrada', 'info');
  });

  // Mobile toggle
  document.getElementById('mobile-toggle').addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    document.getElementById('sidebar').classList.toggle('sidebar--open', sidebarOpen);
  });

  document.getElementById('main-content').addEventListener('click', closeSidebar);

  loadAllData();
}

function closeSidebar() {
  sidebarOpen = false;
  const sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('sidebar--open');
}

// ─── Data Loading ───
async function loadAllData() {
  await Promise.all([loadHabits(), loadHabitLogs(), loadNotes(), loadMoods(), loadGymData(), loadAgendaData()]);
  renderPage();
}

// ─── Gym Presets & Persistence ───
const GYM_DEFAULT_ROUTINES = [
  {
    name: 'Push — Pecho, Hombro & Tríceps',
    description: 'Enfoque en empuje e hipertrofia de torso superior',
    days: ['Lun', 'Jue'],
    color: '#6366f1',
    exercises: [
      { name: 'Press de Banca Plano con Barra', sets: 4, reps: '8-10', weight: 75, rest_seconds: 120, notes: 'Controlar bajada en 2s' },
      { name: 'Press Inclinado con Mancuernas', sets: 3, reps: '10-12', weight: 26, rest_seconds: 90, notes: 'Banco a 30 grados' },
      { name: 'Press Militar con Mancuernas', sets: 3, reps: '8-10', weight: 22, rest_seconds: 90, notes: 'Core firme' },
      { name: 'Elevaciones Laterales', sets: 4, reps: '12-15', weight: 12, rest_seconds: 60, notes: 'Sin balanceo' },
      { name: 'Extensiones de Tríceps en Polea', sets: 3, reps: '12-15', weight: 30, rest_seconds: 60, notes: 'Aislar codos' },
    ],
  },
  {
    name: 'Pull — Espalda & Bíceps',
    description: 'Densidad y amplitud de espalda más trabajo de brazos',
    days: ['Mar', 'Vie'],
    color: '#0ea5e9',
    exercises: [
      { name: 'Dominadas o Jalón al Pecho', sets: 4, reps: '8-10', weight: 0, rest_seconds: 120, notes: 'Rango completo' },
      { name: 'Remo con Barra', sets: 4, reps: '8-10', weight: 70, rest_seconds: 90, notes: 'Espalda recta a 45°' },
      { name: 'Remo Gironda en Polea', sets: 3, reps: '10-12', weight: 60, rest_seconds: 90, notes: 'Pausa 1s en contracción' },
      { name: 'Face Pulls en Polea', sets: 3, reps: '15', weight: 20, rest_seconds: 60, notes: 'Codos altos' },
      { name: 'Curl de Bíceps con Barra Z', sets: 3, reps: '10-12', weight: 30, rest_seconds: 60, notes: 'Controlar excéntrica' },
    ],
  },
  {
    name: 'Legs — Pierna Completa & Core',
    description: 'Fuerza funcional, potencia y desarrollo de tren inferior',
    days: ['Mié', 'Sáb'],
    color: '#10b981',
    exercises: [
      { name: 'Sentadilla Trasera con Barra', sets: 4, reps: '6-8', weight: 90, rest_seconds: 150, notes: 'Paralela o profunda' },
      { name: 'Prensa de Piernas 45°', sets: 3, reps: '10-12', weight: 180, rest_seconds: 120, notes: 'Pies a anchura de hombros' },
      { name: 'Peso Muerto Rumano', sets: 3, reps: '8-10', weight: 80, rest_seconds: 120, notes: 'Isquios en tensión' },
      { name: 'Extensiones de Cuádriceps', sets: 3, reps: '12-15', weight: 50, rest_seconds: 60, notes: 'Pausa arriba' },
      { name: 'Elevaciones de Gemelos', sets: 4, reps: '15-20', weight: 60, rest_seconds: 60, notes: 'Rango completo' },
    ],
  },
];

function persistGymLocal() {
  try {
    localStorage.setItem('mydiscipline_gym_routines', JSON.stringify(gymRoutines));
    localStorage.setItem('mydiscipline_gym_exercises', JSON.stringify(gymExercises));
    localStorage.setItem('mydiscipline_gym_sessions', JSON.stringify(gymSessions));
  } catch (e) {}
}

function playBeepChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

async function loadGymData() {
  let loaded = false;
  if (currentUser) {
    try {
      const [rRes, eRes, sRes] = await Promise.all([
        supabase.from('gym_routines').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: true }),
        supabase.from('gym_exercises').select('*').eq('user_id', currentUser.id).order('sort_order', { ascending: true }),
        supabase.from('gym_sessions').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }).limit(30),
      ]);
      if (!rRes.error && !eRes.error && !sRes.error) {
        gymRoutines = rRes.data || [];
        gymExercises = eRes.data || [];
        gymSessions = sRes.data || [];
        loaded = true;
      }
    } catch (e) {
      console.warn('Supabase gym tables query, using local storage fallback', e);
    }
  }

  if (!loaded) {
    try {
      const lr = localStorage.getItem('mydiscipline_gym_routines');
      const le = localStorage.getItem('mydiscipline_gym_exercises');
      const ls = localStorage.getItem('mydiscipline_gym_sessions');
      if (lr) gymRoutines = JSON.parse(lr);
      if (le) gymExercises = JSON.parse(le);
      if (ls) gymSessions = JSON.parse(ls);
    } catch (e) {}
  }

  if (!gymRoutines || gymRoutines.length === 0) {
    await installDefaultGymPresets();
  }
}

async function installDefaultGymPresets() {
  const newRoutines = [];
  const newExercises = [];

  for (const p of GYM_DEFAULT_ROUTINES) {
    const rId = 'r_' + Math.random().toString(36).substring(2, 9);
    newRoutines.push({
      id: rId,
      user_id: currentUser?.id || 'local',
      name: p.name,
      description: p.description,
      days: p.days,
      color: p.color,
      created_at: new Date().toISOString(),
    });

    p.exercises.forEach((ex, idx) => {
      newExercises.push({
        id: 'e_' + Math.random().toString(36).substring(2, 9),
        routine_id: rId,
        user_id: currentUser?.id || 'local',
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        rest_seconds: ex.rest_seconds,
        notes: ex.notes,
        sort_order: idx,
        created_at: new Date().toISOString(),
      });
    });
  }

  gymRoutines = newRoutines;
  gymExercises = newExercises;
  persistGymLocal();

  if (currentUser) {
    try {
      await supabase.from('gym_routines').insert(newRoutines);
      await supabase.from('gym_exercises').insert(newExercises);
    } catch (e) {}
  }
}

// ─── Agenda & Academic Persistence ───
const AGENDA_DEFAULT_SUBJECTS = [
  {
    id: 'subj_dev',
    name: 'Desarrollo Web & Software',
    code: 'DEV',
    color: '#38bdf8',
    professor: 'Prof. Marcos S.',
    schedule: 'Lun & Mié 09:00 - 11:00',
    storage_type: 'gdrive',
    storage_link: 'https://drive.google.com',
    local_folder_name: null,
  },
  {
    id: 'subj_mat',
    name: 'Matemáticas Discretas & Algoritmos',
    code: 'MAT',
    color: '#6366f1',
    professor: 'Dra. Ramos',
    schedule: 'Mar & Jue 11:30 - 13:30',
    storage_type: 'local',
    storage_link: '',
    local_folder_name: 'Apuntes_Matematicas_2026',
  },
  {
    id: 'subj_emp',
    name: 'Emprendimiento & Negocios',
    code: 'EMP',
    color: '#10b981',
    professor: 'Carlos Valdés (Mentor)',
    schedule: 'Viernes 10:00 - 12:30',
    storage_type: 'onedrive',
    storage_link: 'https://onedrive.live.com',
    local_folder_name: null,
  },
];

const AGENDA_DEFAULT_TASKS = [
  {
    id: 'task_1',
    subject_id: 'subj_dev',
    title: 'Práctica 2: Maquetación Neumórfica & Responsive',
    description: 'Completar diseño responsivo y asegurar accesibilidad WCAG.',
    due_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    due_time: '23:59',
    priority: 'high',
    status: 'pending',
  },
  {
    id: 'task_2',
    subject_id: 'subj_mat',
    title: 'Problemas Tema 3: Grafos y Árboles Binarios',
    description: 'Ejercicios 14 al 28 del boletín de problemas.',
    due_date: new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
    due_time: '18:00',
    priority: 'medium',
    status: 'pending',
  },
  {
    id: 'task_3',
    subject_id: 'subj_emp',
    title: 'Validación de Mercado: 10 Entrevistas con Clientes',
    description: 'Documentar hipótesis del Canvas y feedback recibido.',
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    due_time: '14:00',
    priority: 'high',
    status: 'pending',
  },
];

const AGENDA_DEFAULT_EXAMS = [
  {
    id: 'exam_1',
    subject_id: 'subj_mat',
    title: 'Examen Parcial: Grafos y Complejidad Algorítmica',
    syllabus: 'Temas 1 a 3: Teoría de grafos, caminos mínimos, árboles y recursión.',
    date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    time: '10:00',
    location: 'Aula 2.4 - Edificio Central',
    weight_percent: 40,
    grade: null,
  },
  {
    id: 'exam_2',
    subject_id: 'subj_emp',
    title: 'Pitch Deck & Presentación ante Inversores',
    syllabus: 'Presentación de 5 min con Q&A sobre métricas CAC, LTV y TAM.',
    date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    time: '11:30',
    location: 'Auditorio Principal',
    weight_percent: 50,
    grade: null,
  },
];

const AGENDA_DEFAULT_FILES = [
  {
    id: 'f_1',
    subject_id: 'subj_mat',
    title: 'Resumen_Tema_1_Grafos_Eulerianos.pdf',
    storage_type: 'local',
    file_size: 1024 * 1024 * 2.3,
    url: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'f_2',
    subject_id: 'subj_emp',
    title: 'Plantilla_Business_Model_Canvas.xlsx',
    storage_type: 'onedrive',
    file_size: 1024 * 480,
    url: 'https://onedrive.live.com',
    created_at: new Date().toISOString(),
  },
  {
    id: 'f_3',
    subject_id: 'subj_dev',
    title: 'Guia_CSS_Variables_Neumorfismo.pdf',
    storage_type: 'gdrive',
    file_size: 1024 * 1024 * 1.1,
    url: 'https://drive.google.com',
    created_at: new Date().toISOString(),
  },
];

function persistAgendaLocal() {
  try {
    localStorage.setItem('mydiscipline_agenda_subjects', JSON.stringify(agendaSubjects));
    localStorage.setItem('mydiscipline_agenda_tasks', JSON.stringify(agendaTasks));
    localStorage.setItem('mydiscipline_agenda_exams', JSON.stringify(agendaExams));
    localStorage.setItem('mydiscipline_agenda_files', JSON.stringify(agendaFiles));
  } catch (e) {}
}

async function loadAgendaData() {
  let loaded = false;
  if (currentUser) {
    try {
      const [sRes, tRes, eRes, fRes] = await Promise.all([
        supabase.from('agenda_subjects').select('*').eq('user_id', currentUser.id),
        supabase.from('agenda_tasks').select('*').eq('user_id', currentUser.id),
        supabase.from('agenda_exams').select('*').eq('user_id', currentUser.id),
        supabase.from('agenda_files').select('*').eq('user_id', currentUser.id),
      ]);
      if (!sRes.error && !tRes.error && !eRes.error) {
        agendaSubjects = sRes.data || [];
        agendaTasks = tRes.data || [];
        agendaExams = eRes.data || [];
        agendaFiles = fRes?.data || [];
        loaded = true;
      }
    } catch (e) {}
  }

  if (!loaded) {
    try {
      const ls = localStorage.getItem('mydiscipline_agenda_subjects');
      const lt = localStorage.getItem('mydiscipline_agenda_tasks');
      const le = localStorage.getItem('mydiscipline_agenda_exams');
      const lf = localStorage.getItem('mydiscipline_agenda_files');
      if (ls) agendaSubjects = JSON.parse(ls);
      if (lt) agendaTasks = JSON.parse(lt);
      if (le) agendaExams = JSON.parse(le);
      if (lf) agendaFiles = JSON.parse(lf);
    } catch (e) {}
  }

  if (!agendaSubjects || agendaSubjects.length === 0) {
    agendaSubjects = [...AGENDA_DEFAULT_SUBJECTS];
    agendaTasks = [...AGENDA_DEFAULT_TASKS];
    agendaExams = [...AGENDA_DEFAULT_EXAMS];
    agendaFiles = [...AGENDA_DEFAULT_FILES];
    persistAgendaLocal();
  }
}

async function loadHabits() {
  const { data } = await supabase
    .from('habits')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: true });
  habits = data || [];
}

async function loadHabitLogs() {
  const { data } = await supabase
    .from('habit_logs')
    .select('*')
    .eq('user_id', currentUser.id);
  habitLogs = data || [];
}

async function loadNotes() {
  const { data } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false });
  notes = data || [];
}

async function loadMoods() {
  const { data } = await supabase
    .from('moods')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('date', { ascending: false })
    .limit(30);
  moods = data || [];
}

// ─── Page Router ───
function renderPage() {
  const main = document.getElementById('main-content');
  if (!main) return;

  switch (currentPage) {
    case 'dashboard':
      renderDashboard(main);
      break;
    case 'habits':
      renderHabitsPage(main);
      break;
    case 'gym':
      renderGymPage(main);
      break;
    case 'agenda':
      renderAgendaPage(main);
      break;
    case 'notes':
      renderNotesPage(main);
      break;
    case 'pomodoro':
      renderPomodoroPage(main);
      break;
    case 'mood':
      renderMoodPage(main);
      break;
    default:
      renderDashboard(main);
  }
}

// ─── DASHBOARD ───
function renderDashboard(container) {
  const todayLogs = habitLogs.filter((l) => l.date === todayStr());
  const todayHabits = habits.filter(h => isHabitDueToday(h));
  const completedToday = todayLogs.filter(l => todayHabits.some(h => h.id === l.habit_id)).length;
  const totalHabits = todayHabits.length;
  const todayPercent = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  const longestStreak = calculateLongestStreak();
  const currentStreak = calculateCurrentStreak();
  const quote = getDailyQuote();
  const todayMood = moods.find((m) => m.date === todayStr());

  const upcomingExams = agendaExams
    .filter((e) => new Date(e.date) >= new Date(todayStr()))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  const pendingTasksCount = agendaTasks.filter((t) => t.status !== 'completed').length;

  const weekDays = getWeekDays();
  const today = new Date();
  const isDark = currentTheme === 'dark';

  container.innerHTML = `
    <div class="tab-content">
      <div class="top-header">
        <div>
          <h1 class="page-header__title">
            ${icon('snowflake', { size: 28 })} Winter Arc Dashboard
          </h1>
          <p class="page-header__subtitle">
            ${today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-sm)">
          <div class="winter-arc-badge">
            ${icon('zap', { size: 14 })} Q4 Discipline
          </div>
          <button class="theme-toggle-btn" id="header-theme-btn" aria-label="Cambiar tema">
            <span class="theme-toggle-icon">${icon(isDark ? 'sun' : 'moon', { size: 16 })}</span>
            <span>${isDark ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
      </div>

      <!-- Stoic Quote -->
      <div class="neu-card quote-card" style="margin-bottom: var(--space-lg)">
        <p class="quote-card__text">"${quote.text}"</p>
        <p class="quote-card__author">${icon('shield', { size: 14 })} ${quote.author}</p>
      </div>

      <!-- Week Row -->
      <div class="week-row">
        ${weekDays
          .map((d) => {
            const isToday =
              d.toISOString().split('T')[0] === today.toISOString().split('T')[0];
            return `
            <div class="week-day ${isToday ? 'week-day--today' : ''}">
              <span class="week-day__label">${getDayName(d)}</span>
              <span class="week-day__num">${d.getDate()}</span>
            </div>`;
          })
          .join('')}
      </div>

      <!-- Stats -->
      <div class="dashboard-grid dashboard-grid--stats" style="margin-bottom: var(--space-lg)">
        <div class="stat-card neu-raised-sm">
          <div class="stat-card__icon">${icon('target', { size: 22 })}</div>
          <div class="stat-card__value">${todayPercent}%</div>
          <div class="stat-card__label">Progreso Hoy</div>
        </div>
        <div class="stat-card neu-raised-sm">
          <div class="stat-card__icon" style="color:var(--accent-warning)">${icon('flame', { size: 22 })}</div>
          <div class="stat-card__value">${currentStreak}</div>
          <div class="stat-card__label">Racha Días</div>
        </div>
        <div class="stat-card neu-raised-sm">
          <div class="stat-card__icon" style="color:var(--accent-silver)">${icon('trophy', { size: 22 })}</div>
          <div class="stat-card__value">${longestStreak}</div>
          <div class="stat-card__label">Mejor Racha</div>
        </div>
        <div class="stat-card neu-raised-sm">
          <div class="stat-card__icon" style="color:var(--accent-success)">${icon('brain', { size: 22 })}</div>
          <div class="stat-card__value">${todayMood ? todayMood.mood.toUpperCase() : '—'}</div>
          <div class="stat-card__label">Fuerza Mental</div>
        </div>
      </div>

      <!-- Main Dashboard Grid -->
      <div class="dashboard-grid">
        <!-- Today's Habits -->
        <div class="neu-card">
          <div class="neu-card__header">
            <h2 class="neu-card__title">
              ${icon('snowflake', { size: 20 })} Hábitos Activos
            </h2>
            <span class="neu-badge ${todayPercent === 100 ? 'neu-badge--success' : todayPercent >= 50 ? 'neu-badge--info' : 'neu-badge--warning'}">
              ${completedToday}/${totalHabits}
            </span>
          </div>
          <div class="neu-progress" style="margin-bottom: var(--space-md)">
            <div class="neu-progress__fill ${todayPercent === 100 ? 'neu-progress__fill--success' : ''}" style="width: ${todayPercent}%"></div>
          </div>
          ${todayHabits.length === 0
            ? `<div class="empty-state">
                <div class="empty-state__icon">${icon('snowflake', { size: 30 })}</div>
                <div class="empty-state__text">${habits.length === 0 ? 'Sin hábitos configurados' : '¡Hoy no toca ningún hábito!'}</div>
                <div class="empty-state__hint">${habits.length === 0 ? 'Añade rutinas del Winter Arc para forjar disciplina' : 'Tus hábitos están descansando hoy'}</div>
              </div>`
            : todayHabits
                .slice(0, 6)
                .map((h) => {
                  const done = todayLogs.some((l) => l.habit_id === h.id);
                  const iconName = h.icon && ICONS[h.icon] ? h.icon : 'snowflake';
                  return `
                  <div class="habit-item neu-raised-sm" style="margin-bottom: var(--space-sm)">
                    <div class="habit-item__check ${done ? 'habit-item__check--done' : ''}" data-habit-id="${h.id}" data-dash-toggle>
                      ${done ? icon('check', { size: 18, color: '#ffffff' }) : ''}
                    </div>
                    <div class="habit-item__info">
                      <div class="habit-item__name">
                        <span class="icon-badge">${icon(iconName, { size: 18 })}</span>
                        ${h.name}
                      </div>
                    </div>
                  </div>`;
                })
                .join('')}
        </div>

        <!-- Recent Notes -->
        <div class="neu-card">
          <div class="neu-card__header">
            <h2 class="neu-card__title">
              ${icon('book', { size: 20 })} Diario & Notas Recientes
            </h2>
          </div>
          ${notes.length === 0
            ? `<div class="empty-state">
                <div class="empty-state__icon">${icon('book', { size: 30 })}</div>
                <div class="empty-state__text">Sin entradas en el diario</div>
                <div class="empty-state__hint">Anota reflexiones estoicas o tareas clave</div>
              </div>`
            : notes
                .slice(0, 4)
                .map(
                  (n) => `
                <div class="note-item neu-raised-sm" style="margin-bottom: var(--space-sm)">
                  <div class="note-item__color" style="background: ${n.color || 'var(--accent-primary)'}"></div>
                  <div class="note-item__content">
                    <div class="note-item__title">${n.title}</div>
                    <div class="note-item__text">${n.content || ''}</div>
                    <div class="note-item__meta">${formatDateTime(n.updated_at)}</div>
                  </div>
                </div>`
                )
                .join('')}
        </div>

        <!-- Academic Deadlines Widget -->
        <div class="neu-card" style="grid-column: 1 / -1">
          <div class="neu-card__header">
            <h2 class="neu-card__title">
              ${icon('academic', { size: 20 })} Agenda & Exámenes Críticos
            </h2>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="neu-badge neu-badge--warning">${pendingTasksCount} tareas pendientes</span>
              <button class="neu-btn neu-btn--sm" id="dash-go-agenda-btn">Ver Agenda Completa →</button>
            </div>
          </div>
          ${upcomingExams.length === 0
            ? `<div class="empty-state" style="padding:var(--space-md)">
                <div class="empty-state__icon" style="width:40px;height:40px">${icon('academic', { size: 20 })}</div>
                <div class="empty-state__text" style="font-size:0.9rem">Sin exámenes próximos programados</div>
                <div class="empty-state__hint">Añade hitos importantes en tu agenda para activar la cuenta atrás</div>
              </div>`
            : `<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:var(--space-md)">
                ${upcomingExams.map(ex => {
                  const subj = agendaSubjects.find(s => s.id === ex.subject_id);
                  const cd = getExamCountdownInfo(ex.date);
                  return `
                    <div class="exam-card" style="margin-bottom:0">
                      <div class="exam-card__top">
                        <div>
                          <div class="exam-card__title">${ex.title}</div>
                          ${subj ? `
                            <div class="subject-tag" style="margin-top:4px">
                              <span class="subject-tag__dot" style="background:${subj.color || '#38bdf8'}"></span>
                              <span>${subj.name}</span>
                            </div>
                          ` : ''}
                        </div>
                        <span class="countdown-badge ${cd.badgeClass}">${cd.text}</span>
                      </div>
                      <div class="exam-card__meta">
                        <span>📅 ${formatDate(ex.date)} ${ex.time ? '• ⏰ ' + ex.time : ''}</span>
                        ${ex.location ? `<span>📍 ${ex.location}</span>` : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>`
          }
        </div>
      </div>
    </div>
  `;

  document.getElementById('header-theme-btn').addEventListener('click', toggleTheme);

  document.getElementById('dash-go-agenda-btn')?.addEventListener('click', () => {
    currentPage = 'agenda';
    renderAppShell();
    renderPage();
  });

  container.querySelectorAll('[data-dash-toggle]').forEach((el) => {
    el.addEventListener('click', () => toggleHabitLog(el.dataset.habitId));
  });
}

// ─── Streak Calculations ───
function calculateCurrentStreak() {
  if (habits.length === 0) return 0;
  let streak = 0;
  const d = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().split('T')[0];
    const logsForDay = habitLogs.filter((l) => l.date === dateStr);
    const allDone = habits.every((h) => logsForDay.some((l) => l.habit_id === h.id));

    if (allDone && habits.length > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function calculateLongestStreak() {
  if (habits.length === 0) return 0;
  let longest = 0;
  let current = 0;
  const d = new Date();

  for (let i = 89; i >= 0; i--) {
    const dateStr = new Date(d.getFullYear(), d.getMonth(), d.getDate() - i)
      .toISOString()
      .split('T')[0];
    const logsForDay = habitLogs.filter((l) => l.date === dateStr);
    const allDone = habits.every((h) => logsForDay.some((l) => l.habit_id === h.id));

    if (allDone) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

// ─── HABITS PAGE ───
function renderHabitsPage(container) {
  const todayLogs = habitLogs.filter((l) => l.date === todayStr());
  const last90 = getLast90Days();

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md)">
        <div>
          <h1 class="page-header__title">
            ${icon('snowflake', { size: 28 })} Habit Tracker
          </h1>
          <p class="page-header__subtitle">Forja una disciplina inquebrantable cada día</p>
        </div>
        <button class="neu-btn neu-btn--primary" id="add-habit-btn">
          ${icon('plus', { size: 18 })} Nuevo Hábito
        </button>
      </div>

      <!-- Presets Banner -->
      <div class="neu-card" style="margin-bottom: var(--space-lg)">
        <div class="neu-card__header" style="margin-bottom: var(--space-sm)">
          <h2 class="neu-card__title">
            ${icon('zap', { size: 18 })} Protocolos Populares Winter Arc
          </h2>
        </div>
        <div class="presets-grid">
          ${WINTER_ARC_PRESETS.slice(0, 6).map(p => `
            <div class="preset-card" data-preset="${p.id}">
              <div class="preset-card__icon">${icon(p.icon, { size: 24 })}</div>
              <div class="preset-card__name">${p.name}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Heatmap -->
      <div class="neu-card" style="margin-bottom: var(--space-lg)">
        <div class="neu-card__header">
          <h2 class="neu-card__title">
            ${icon('calendar', { size: 20 })} Matriz de Disciplina (90 días)
          </h2>
        </div>
        <div class="heatmap" id="heatmap">
          ${renderHeatmap(last90)}
        </div>
      </div>

      <!-- Habit List -->
      <div class="habits-grid" id="habits-list">
        ${habits.length === 0
          ? `<div class="neu-card empty-state">
              <div class="empty-state__icon">${icon('snowflake', { size: 36 })}</div>
              <div class="empty-state__text">Aún no tienes hábitos registrados</div>
              <div class="empty-state__hint">Selecciona un protocolo de arriba o crea uno personalizado</div>
            </div>`
          : habits
              .map((h) => {
                const done = todayLogs.some((l) => l.habit_id === h.id);
                const streak = getHabitStreak(h.id);
                const iconName = h.icon && ICONS[h.icon] ? h.icon : 'snowflake';
                return `
                <div class="habit-item neu-card">
                  <div class="habit-item__check ${done ? 'habit-item__check--done' : ''}" data-habit-id="${h.id}">
                    ${done ? icon('check', { size: 20, color: '#ffffff' }) : ''}
                  </div>
                  <div class="habit-item__info">
                    <div class="habit-item__name">
                      <span class="icon-badge">${icon(iconName, { size: 18 })}</span>
                      ${h.name}
                    </div>
                    <div class="habit-item__streak">
                      ${icon('flame', { size: 14, color: 'var(--accent-warning)' })} Racha: ${streak} días
                    </div>
                  </div>
                  <span class="habit-item__frequency neu-badge neu-badge--info">${h.frequency || 'Diario'}</span>
                  <div class="habit-item__actions">
                    <button class="neu-btn neu-btn--icon-sm" data-edit-habit="${h.id}" title="Editar">
                      ${icon('edit', { size: 15 })}
                    </button>
                    <button class="neu-btn neu-btn--icon-sm" data-delete-habit="${h.id}" title="Eliminar">
                      ${icon('trash', { size: 15 })}
                    </button>
                  </div>
                </div>`;
              })
              .join('')}
      </div>
    </div>
  `;

  // Quick Preset Add
  container.querySelectorAll('[data-preset]').forEach((el) => {
    el.addEventListener('click', () => {
      const preset = WINTER_ARC_PRESETS.find(p => p.id === el.dataset.preset);
      if (preset) {
        showHabitModal({ name: preset.name, icon: preset.icon, frequency: 'Diario' });
      }
    });
  });

  // Toggle habit
  container.querySelectorAll('.habit-item__check[data-habit-id]').forEach((el) => {
    el.addEventListener('click', () => toggleHabitLog(el.dataset.habitId));
  });

  // Add habit
  document.getElementById('add-habit-btn').addEventListener('click', () => showHabitModal());

  // Edit habit
  container.querySelectorAll('[data-edit-habit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const h = habits.find((hb) => hb.id === btn.dataset.editHabit);
      if (h) showHabitModal(h);
    });
  });

  // Delete habit
  container.querySelectorAll('[data-delete-habit]').forEach((btn) => {
    btn.addEventListener('click', () => deleteHabit(btn.dataset.deleteHabit));
  });
}

function renderHeatmap(days) {
  const weeks = [];
  let currentWeek = [];

  days.forEach((day, i) => {
    const d = new Date(day);
    const dow = d.getDay();

    if (i === 0 && dow !== 1) {
      for (let j = 0; j < (dow === 0 ? 6 : dow - 1); j++) {
        currentWeek.push(null);
      }
    }

    currentWeek.push(day);

    if (dow === 0 || i === days.length - 1) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  return weeks
    .map(
      (week) =>
        `<div class="heatmap__week">${week
          .map((day) => {
            if (!day) return '<div class="heatmap__day" style="opacity:0"></div>';
            const logsForDay = habitLogs.filter((l) => l.date === day);
            const total = habits.length || 1;
            const ratio = logsForDay.length / total;
            let level = '';
            if (ratio > 0 && ratio <= 0.25) level = 'heatmap__day--l1';
            else if (ratio > 0.25 && ratio <= 0.5) level = 'heatmap__day--l2';
            else if (ratio > 0.5 && ratio <= 0.75) level = 'heatmap__day--l3';
            else if (ratio > 0.75) level = 'heatmap__day--l4';
            return `<div class="heatmap__day ${level}" title="${formatDate(day)}: ${logsForDay.length}/${habits.length}"></div>`;
          })
          .join('')}</div>`
    )
    .join('');
}

function getHabitStreak(habitId) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().split('T')[0];
    const has = habitLogs.some((l) => l.habit_id === habitId && l.date === dateStr);
    if (has) {
      streak++;
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

async function toggleHabitLog(habitId) {
  const today = todayStr();
  const existing = habitLogs.find((l) => l.habit_id === habitId && l.date === today);

  if (existing) {
    await supabase.from('habit_logs').delete().eq('id', existing.id);
    habitLogs = habitLogs.filter((l) => l.id !== existing.id);
  } else {
    const { data } = await supabase
      .from('habit_logs')
      .insert({ user_id: currentUser.id, habit_id: habitId, date: today })
      .select()
      .single();
    if (data) habitLogs.push(data);
  }
  renderPage();
}

function showHabitModal(editHabit = null) {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const selectableIcons = [
    'snowflake', 'dumbbell', 'zap', 'brain', 'book', 'droplet',
    'mountain', 'shield', 'flame', 'target', 'sunrise', 'lock', 'swords', 'trophy'
  ];

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-content">
      <h2 style="font-size:1.25rem;font-weight:800;margin-bottom:var(--space-lg);display:flex;align-items:center;gap:8px">
        ${icon('snowflake', { size: 22 })} ${editHabit ? 'Editar Hábito' : 'Nuevo Hábito Winter Arc'}
      </h2>
      <form id="habit-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="habit-name">Nombre del Hábito</label>
          <input type="text" id="habit-name" class="neu-input" placeholder="Ej: Ducha Fría 3 Min" required value="${editHabit?.name || ''}" />
        </div>
        <div class="neu-input-wrapper">
          <label>Icono Winter Arc</label>
          <div class="chip-group" id="icon-selector" style="gap:8px">
            ${selectableIcons
              .map(
                (ic) =>
                  `<span class="chip ${editHabit?.icon === ic ? 'chip--active' : (!editHabit && ic === 'snowflake') ? 'chip--active' : ''}" data-icon="${ic}" style="display:inline-flex;align-items:center;gap:6px">
                    ${icon(ic, { size: 16 })} ${ic}
                  </span>`
              )
              .join('')}
          </div>
        </div>
        <div class="neu-input-wrapper">
          <label>Días de la semana</label>
          <div class="day-picker-presets" style="margin-bottom:var(--space-sm)">
            <span class="chip" id="hp-all">Diario</span>
            <span class="chip" id="hp-lv">L-V</span>
            <span class="chip" id="hp-3x">3×/sem</span>
          </div>
          <div class="day-picker">
            ${[{k:'Lun',l:'L'},{k:'Mar',l:'M'},{k:'Mi\u00e9',l:'X'},{k:'Jue',l:'J'},{k:'Vie',l:'V'},{k:'S\u00e1b',l:'S'},{k:'Dom',l:'D'}]
              .map(d => `<button type="button" class="day-btn ${getInitialHabitDays(editHabit).includes(d.k) ? 'day-btn--active' : ''}" data-hday="${d.k}">${d.l}</button>`)
              .join('')}
          </div>
        </div>
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button type="button" class="neu-btn" id="habit-cancel">Cancelar</button>
          <button type="submit" class="neu-btn neu-btn--primary">${editHabit ? 'Guardar Cambios' : 'Confirmar Hábito'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  let selectedIcon = editHabit?.icon || 'snowflake';
  let selectedDays = getInitialHabitDays(editHabit);

  backdrop.querySelectorAll('[data-icon]').forEach((el) => {
    el.addEventListener('click', () => {
      backdrop.querySelectorAll('[data-icon]').forEach((e) => e.classList.remove('chip--active'));
      el.classList.add('chip--active');
      selectedIcon = el.dataset.icon;
    });
  });

  const ALL_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const syncDayBtns = () => backdrop.querySelectorAll('[data-hday]').forEach(b => b.classList.toggle('day-btn--active', selectedDays.includes(b.dataset.hday)));

  document.getElementById('hp-all').addEventListener('click', () => { selectedDays = [...ALL_DAYS]; syncDayBtns(); });
  document.getElementById('hp-lv').addEventListener('click', () => { selectedDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']; syncDayBtns(); });
  document.getElementById('hp-3x').addEventListener('click', () => { selectedDays = ['Lun', 'Mié', 'Vie']; syncDayBtns(); });

  backdrop.querySelectorAll('[data-hday]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.hday;
      selectedDays = selectedDays.includes(d) ? selectedDays.filter(x => x !== d) : [...selectedDays, d];
      btn.classList.toggle('day-btn--active', selectedDays.includes(d));
    });
  });

  document.getElementById('habit-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  document.getElementById('habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('habit-name').value.trim();
    const frequency = daysToFrequency(selectedDays);

    if (!name) return;

    if (editHabit && editHabit.id) {
      const { data } = await supabase
        .from('habits')
        .update({ name, icon: selectedIcon, frequency })
        .eq('id', editHabit.id)
        .select()
        .single();
      if (data) {
        const idx = habits.findIndex((h) => h.id === data.id);
        if (idx >= 0) habits[idx] = data;
        showToast('Hábito actualizado', 'success');
      }
    } else {
      const { data } = await supabase
        .from('habits')
        .insert({ user_id: currentUser.id, name, icon: selectedIcon, frequency })
        .select()
        .single();
      if (data) {
        habits.push(data);
        showToast('¡Hábito añadido al Winter Arc! ❄️', 'success');
      }
    }

    backdrop.remove();
    renderPage();
  });
}

async function deleteHabit(id) {
  if (!confirm('¿Eliminar este hábito y su historial?')) return;

  await supabase.from('habit_logs').delete().eq('habit_id', id);
  await supabase.from('habits').delete().eq('id', id);
  habits = habits.filter((h) => h.id !== id);
  habitLogs = habitLogs.filter((l) => l.habit_id !== id);
  showToast('Hábito eliminado', 'info');
  renderPage();
}

// ─── GYM & STRENGTH PAGE ───
function renderGymPage(container) {
  if (gymActiveWorkout) {
    renderActiveWorkout(container);
    return;
  }

  const totalSessions = gymSessions.length;
  const totalMinutes = gymSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md)">
        <div>
          <h1 class="page-header__title">
            ${icon('dumbbell', { size: 28 })} Gym & Rutinas de Fuerza
          </h1>
          <p class="page-header__subtitle">Rutinas personalizadas, seguimiento de series, peso y descanso</p>
        </div>
        <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap">
          <button class="neu-btn" id="restore-gym-presets-btn" title="Cargar plantillas Push/Pull/Legs">
            ${icon('rotate', { size: 16 })} Plantillas
          </button>
          <button class="neu-btn neu-btn--primary" id="add-routine-btn">
            ${icon('plus', { size: 18 })} Nueva Rutina
          </button>
        </div>
      </div>

      <!-- Gym Stats Bar -->
      <div class="gym-stats-bar">
        <div class="neu-card" style="padding:var(--space-md);text-align:center">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Rutinas Activas</div>
          <div style="font-size:1.8rem;font-weight:800;color:var(--text-primary);margin-top:4px">${gymRoutines.length}</div>
        </div>
        <div class="neu-card" style="padding:var(--space-md);text-align:center">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Sesiones Registradas</div>
          <div style="font-size:1.8rem;font-weight:800;color:var(--accent-success);margin-top:4px">${totalSessions}</div>
        </div>
        <div class="neu-card" style="padding:var(--space-md);text-align:center">
          <div style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Tiempo Entrenado</div>
          <div style="font-size:1.8rem;font-weight:800;color:#38bdf8;margin-top:4px">${totalMinutes} min</div>
        </div>
      </div>

      <!-- Sub Tabs -->
      <div class="chip-group" style="margin-bottom:var(--space-lg)">
        <span class="chip ${gymTab === 'routines' ? 'chip--active' : ''}" data-gym-tab="routines">
          ${icon('dumbbell', { size: 15 })} Mis Rutinas (${gymRoutines.length})
        </span>
        <span class="chip ${gymTab === 'history' ? 'chip--active' : ''}" data-gym-tab="history">
          ${icon('calendar', { size: 15 })} Historial de Entrenamientos (${totalSessions})
        </span>
      </div>

      ${gymTab === 'routines' ? `
        <!-- Routines Grid -->
        <div class="gym-routines-grid">
          ${gymRoutines.length === 0 ? `
            <div class="neu-card empty-state" style="grid-column:1/-1">
              <div class="empty-state__icon">${icon('dumbbell', { size: 36 })}</div>
              <div class="empty-state__text">No tienes rutinas de entrenamiento aún</div>
              <div class="empty-state__hint">Haz clic en "+ Nueva Rutina" o carga las plantillas Push/Pull/Legs predefinidas</div>
              <button class="neu-btn neu-btn--primary" id="empty-load-presets-btn" style="margin-top:var(--space-md)">
                ${icon('zap', { size: 16 })} Cargar Plantillas Winter Arc
              </button>
            </div>
          ` : gymRoutines.map(r => {
            const exercises = gymExercises.filter(e => e.routine_id === r.id);
            const days = Array.isArray(r.days) ? r.days : (r.days ? r.days.split(',') : []);
            return `
              <div class="neu-card routine-card">
                <div class="routine-card__color-bar" style="background:${r.color || '#6366f1'}"></div>
                <div>
                  <div class="routine-card__header">
                    <h2 class="routine-card__title">${r.name}</h2>
                    <div style="display:flex;gap:4px">
                      <button class="neu-btn neu-btn--icon-sm" data-edit-routine="${r.id}" title="Editar Rutina">
                        ${icon('edit', { size: 14 })}
                      </button>
                      <button class="neu-btn neu-btn--icon-sm" data-delete-routine="${r.id}" title="Eliminar Rutina">
                        ${icon('trash', { size: 14 })}
                      </button>
                    </div>
                  </div>
                  ${r.description ? `<p class="routine-card__desc">${r.description}</p>` : ''}
                  ${days.length > 0 ? `
                    <div class="routine-card__days">
                      ${days.map(d => `<span class="routine-card__day-tag">${d}</span>`).join('')}
                    </div>
                  ` : ''}

                  <!-- Exercises Preview -->
                  <div class="routine-exercises-preview">
                    ${exercises.length === 0 ? `
                      <span style="font-size:0.78rem;color:var(--text-muted);font-style:italic">Sin ejercicios configurados aún</span>
                    ` : exercises.slice(0, 5).map(e => `
                      <div class="routine-exercise-preview-item">
                        <span style="font-weight:600;color:var(--text-primary)">${e.name}</span>
                        <span style="font-variant-numeric:tabular-nums;color:var(--text-muted)">
                          ${e.sets}×${e.reps} ${e.weight > 0 ? `(${e.weight}kg)` : ''}
                        </span>
                      </div>
                    `).join('')}
                    ${exercises.length > 5 ? `
                      <div style="font-size:0.75rem;color:var(--text-muted);text-align:right">+${exercises.length - 5} ejercicios más</div>
                    ` : ''}
                  </div>
                </div>

                <div class="routine-card__footer">
                  <span class="neu-badge neu-badge--info">${exercises.length} ejercicios</span>
                  <button class="neu-btn neu-btn--primary" data-start-routine="${r.id}">
                    ${icon('play', { size: 16 })} Iniciar
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <!-- History List -->
        <div class="neu-card" style="max-width:800px;margin:0 auto">
          <div class="neu-card__header">
            <h2 class="neu-card__title">${icon('calendar', { size: 20 })} Sesiones Completadas</h2>
          </div>
          ${gymSessions.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state__icon">${icon('timer', { size: 36 })}</div>
              <div class="empty-state__text">Sin registros de entrenamientos</div>
              <div class="empty-state__hint">Selecciona una rutina y dale a "Iniciar" para registrar tu primera sesión</div>
            </div>
          ` : gymSessions.map(s => {
            const routine = gymRoutines.find(r => r.id === s.routine_id);
            const routineName = s.routine_name || routine?.name || 'Entrenamiento Libre';
            return `
              <div class="gym-history-item">
                <div>
                  <div style="font-weight:800;font-size:1.05rem;color:var(--text-primary)">${routineName}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">
                    ${formatDate(s.date)} • ⏱️ ${s.duration_minutes || 0} min
                  </div>
                  ${s.notes ? `<div style="font-size:0.82rem;color:var(--text-secondary);margin-top:6px;font-style:italic">"${s.notes}"</div>` : ''}
                </div>
                <div>
                  <button class="neu-btn neu-btn--icon-sm" data-delete-session="${s.id}" title="Eliminar registro">
                    ${icon('trash', { size: 14 })}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  // Sub tabs event
  container.querySelectorAll('[data-gym-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      gymTab = tab.dataset.gymTab;
      renderGymPage(container);
    });
  });

  // Add routine button
  document.getElementById('add-routine-btn')?.addEventListener('click', () => showRoutineModal());
  document.getElementById('empty-load-presets-btn')?.addEventListener('click', async () => {
    await installDefaultGymPresets();
    showToast('¡Plantillas cargadas con éxito! 💪', 'success');
    renderGymPage(container);
  });
  document.getElementById('restore-gym-presets-btn')?.addEventListener('click', async () => {
    if (confirm('¿Cargar las plantillas predefinidas del Winter Arc (Push/Pull/Legs)?')) {
      await installDefaultGymPresets();
      showToast('Plantillas añadidas ❄️', 'success');
      renderGymPage(container);
    }
  });

  // Routine actions
  container.querySelectorAll('[data-start-routine]').forEach(btn => {
    btn.addEventListener('click', () => startWorkout(btn.dataset.startRoutine));
  });

  container.querySelectorAll('[data-edit-routine]').forEach(btn => {
    btn.addEventListener('click', () => {
      const routine = gymRoutines.find(r => r.id === btn.dataset.editRoutine);
      if (routine) showRoutineModal(routine);
    });
  });

  container.querySelectorAll('[data-delete-routine]').forEach(btn => {
    btn.addEventListener('click', () => deleteRoutine(btn.dataset.deleteRoutine));
  });

  container.querySelectorAll('[data-delete-session]').forEach(btn => {
    btn.addEventListener('click', () => deleteGymSession(btn.dataset.deleteSession));
  });
}

// ─── ACTIVE WORKOUT VIEW ───
function renderActiveWorkout(container) {
  if (!gymActiveWorkout) return;

  const routine = gymRoutines.find(r => r.id === gymActiveWorkout.routineId);
  const exercises = gymExercises.filter(e => e.routine_id === gymActiveWorkout.routineId);

  const hours = Math.floor(gymWorkoutElapsed / 3600);
  const mins = Math.floor((gymWorkoutElapsed % 3600) / 60);
  const secs = gymWorkoutElapsed % 60;
  const timeFormatted = (hours > 0 ? `${hours.toString().padStart(2, '0')}:` : '') +
    `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const restMins = Math.floor(gymRestSecondsLeft / 60).toString().padStart(2, '0');
  const restSecs = (gymRestSecondsLeft % 60).toString().padStart(2, '0');

  container.innerHTML = `
    <div class="tab-content active-workout">
      <!-- Top Workout Status Banner -->
      <div class="workout-banner">
        <div>
          <span class="neu-badge neu-badge--success" style="margin-bottom:4px">EN VIVO</span>
          <h1 style="font-size:1.4rem;font-weight:800;color:var(--text-primary)">
            ${gymActiveWorkout.routineName}
          </h1>
        </div>

        <div class="workout-timer-box">
          <span style="color:var(--text-muted)">${icon('timer', { size: 24 })}</span>
          <div class="workout-timer-display" id="workout-clock">${timeFormatted}</div>
        </div>

        <div style="display:flex;gap:var(--space-sm);align-items:center">
          <button class="neu-btn neu-btn--danger" id="workout-cancel-btn">
            ${icon('x', { size: 16 })} Cancelar
          </button>
          <button class="neu-btn neu-btn--primary" id="workout-finish-btn">
            ${icon('check', { size: 16 })} Terminar
          </button>
        </div>
      </div>

      <!-- Rest Timer Card -->
      <div class="rest-timer-card" id="gym-rest-card" style="display:${gymRestTimer ? 'flex' : 'none'}">
        <div style="display:flex;align-items:center;gap:12px">
          <span style="color:#38bdf8">${icon('timer', { size: 26 })}</span>
          <div>
            <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Descanso entre series</div>
            <div class="rest-timer-display" id="gym-rest-countdown">${restMins}:${restSecs}</div>
          </div>
        </div>

        <div style="display:flex;gap:var(--space-xs);align-items:center">
          <button type="button" class="neu-btn neu-btn--sm" id="rest-sub-15">-15s</button>
          <button type="button" class="neu-btn neu-btn--sm" id="rest-add-30">+30s</button>
          <button type="button" class="neu-btn neu-btn--sm neu-btn--primary" id="rest-skip">Saltar</button>
        </div>
      </div>

      <!-- Exercise Cards -->
      ${exercises.map(ex => {
        const state = gymActiveWorkout.exerciseStates[ex.id] || { sets: [] };
        return `
          <div class="neu-card workout-exercise-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
              <div>
                <h3 style="font-size:1.1rem;font-weight:800;color:var(--text-primary)">${ex.name}</h3>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:2px">
                  Objetivo: <strong>${ex.sets} series × ${ex.reps} reps</strong>
                  ${ex.weight > 0 ? ` • ${ex.weight} kg` : ''}
                  • ⏱️ ${ex.rest_seconds || 90}s descanso
                </div>
                ${ex.notes ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;font-style:italic">💡 ${ex.notes}</div>` : ''}
              </div>
              <button class="neu-btn neu-btn--sm" data-quick-rest="${ex.rest_seconds || 90}">
                ${icon('timer', { size: 14 })} ${ex.rest_seconds || 90}s
              </button>
            </div>

            <!-- Sets Table -->
            <table class="sets-table">
              <thead>
                <tr>
                  <th style="width:40px">Serie</th>
                  <th>Peso (kg)</th>
                  <th>Reps</th>
                  <th style="width:50px">Listo</th>
                </tr>
              </thead>
              <tbody>
                ${state.sets.map((s, idx) => `
                  <tr class="set-row ${s.done ? 'set-row--done' : ''}">
                    <td style="font-weight:700;color:var(--text-muted)">${idx + 1}</td>
                    <td>
                      <input type="number" step="0.5" class="set-input" value="${s.weight ?? ex.weight ?? 0}"
                             data-ex-id="${ex.id}" data-set-idx="${idx}" data-field="weight" />
                    </td>
                    <td>
                      <input type="text" class="set-input" value="${s.reps ?? ex.reps ?? 10}"
                             data-ex-id="${ex.id}" data-set-idx="${idx}" data-field="reps" />
                    </td>
                    <td>
                      <button type="button" class="set-check-btn ${s.done ? 'set-check-btn--done' : ''}"
                              data-toggle-set="${ex.id}" data-set-idx="${idx}" data-rest="${ex.rest_seconds || 90}">
                        ${s.done ? icon('check', { size: 18 }) : (idx + 1)}
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div style="margin-top:var(--space-sm);text-align:right">
              <button type="button" class="neu-btn neu-btn--sm" data-add-set-to="${ex.id}">
                ${icon('plus', { size: 14 })} Añadir Serie
              </button>
            </div>
          </div>
        `;
      }).join('')}

      <!-- Workout Sensations Note -->
      <div class="neu-card" style="margin-top:var(--space-lg)">
        <label style="display:block;font-size:0.85rem;font-weight:700;color:var(--text-secondary);margin-bottom:var(--space-xs)">
          Notas y Sensaciones de la Sesión
        </label>
        <textarea id="workout-notes" class="neu-textarea" placeholder="¿Cómo te has sentido? Pesos superados, RPE, fatiga...">${gymActiveWorkout.notes || ''}</textarea>
      </div>

      <!-- Bottom Finish Button -->
      <div style="margin-top:var(--space-xl);margin-bottom:var(--space-2xl)">
        <button class="neu-btn neu-btn--primary neu-btn--lg" id="workout-finish-bottom" style="width:100%;justify-content:center">
          ${icon('check', { size: 20 })} Finalizar y Guardar Sesión de Gym
        </button>
      </div>
    </div>
  `;

  // Listeners for sets inputs
  container.querySelectorAll('.set-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const exId = e.target.dataset.exId;
      const idx = parseInt(e.target.dataset.setIdx);
      const field = e.target.dataset.field;
      if (gymActiveWorkout.exerciseStates[exId]?.sets[idx]) {
        gymActiveWorkout.exerciseStates[exId].sets[idx][field] = e.target.value;
      }
    });
  });

  // Listeners for check buttons
  container.querySelectorAll('[data-toggle-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      const exId = btn.dataset.toggleSet;
      const idx = parseInt(btn.dataset.setIdx);
      const restSec = parseInt(btn.dataset.rest) || 90;

      const setObj = gymActiveWorkout.exerciseStates[exId]?.sets[idx];
      if (!setObj) return;

      setObj.done = !setObj.done;

      if (setObj.done) {
        playBeepChime();
        startRestTimer(restSec);
        showToast('¡Serie completada! Descanso iniciado ⏱️', 'success');
      }

      renderActiveWorkout(container);
    });
  });

  // Add set listener
  container.querySelectorAll('[data-add-set-to]').forEach(btn => {
    btn.addEventListener('click', () => {
      const exId = btn.dataset.addSetTo;
      const ex = gymExercises.find(e => e.id === exId);
      const sets = gymActiveWorkout.exerciseStates[exId]?.sets;
      if (sets) {
        const last = sets[sets.length - 1];
        sets.push({
          setNum: sets.length + 1,
          weight: last ? last.weight : (ex?.weight || 0),
          reps: last ? last.reps : (ex?.reps || 10),
          done: false,
        });
        renderActiveWorkout(container);
      }
    });
  });

  // Quick rest timer buttons
  container.querySelectorAll('[data-quick-rest]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = parseInt(btn.dataset.quickRest) || 90;
      startRestTimer(s);
    });
  });

  // Rest controls
  document.getElementById('rest-add-30')?.addEventListener('click', () => {
    gymRestSecondsLeft += 30;
  });
  document.getElementById('rest-sub-15')?.addEventListener('click', () => {
    gymRestSecondsLeft = Math.max(0, gymRestSecondsLeft - 15);
  });
  document.getElementById('rest-skip')?.addEventListener('click', () => {
    clearInterval(gymRestTimer);
    gymRestTimer = null;
    const box = document.getElementById('gym-rest-card');
    if (box) box.style.display = 'none';
  });

  // Notes listener
  document.getElementById('workout-notes')?.addEventListener('input', (e) => {
    if (gymActiveWorkout) gymActiveWorkout.notes = e.target.value;
  });

  // Cancel workout
  document.getElementById('workout-cancel-btn')?.addEventListener('click', () => {
    if (confirm('¿Cancelar este entrenamiento? No se guardará el registro.')) {
      clearInterval(gymWorkoutTimer);
      clearInterval(gymRestTimer);
      gymWorkoutTimer = null;
      gymRestTimer = null;
      gymActiveWorkout = null;
      renderGymPage(container);
      showToast('Entrenamiento cancelado', 'info');
    }
  });

  // Finish workout
  const handleFinish = () => finishActiveWorkout();
  document.getElementById('workout-finish-btn')?.addEventListener('click', handleFinish);
  document.getElementById('workout-finish-bottom')?.addEventListener('click', handleFinish);
}

// ─── WORKOUT LOGIC ───
function startWorkout(routineId) {
  const routine = gymRoutines.find(r => r.id === routineId);
  if (!routine) return;

  const exercises = gymExercises.filter(e => e.routine_id === routineId);

  const exerciseStates = {};
  exercises.forEach(ex => {
    const setsCount = parseInt(ex.sets) || 3;
    exerciseStates[ex.id] = {
      exercise: ex,
      sets: Array.from({ length: setsCount }, (_, i) => ({
        setNum: i + 1,
        weight: ex.weight || 0,
        reps: ex.reps || 10,
        done: false,
      })),
    };
  });

  gymActiveWorkout = {
    routineId: routine.id,
    routineName: routine.name,
    startTime: Date.now(),
    exerciseStates,
    notes: '',
  };

  gymWorkoutElapsed = 0;
  if (gymWorkoutTimer) clearInterval(gymWorkoutTimer);
  gymWorkoutTimer = setInterval(() => {
    gymWorkoutElapsed++;
    const clock = document.getElementById('workout-clock');
    if (clock) {
      const h = Math.floor(gymWorkoutElapsed / 3600);
      const m = Math.floor((gymWorkoutElapsed % 3600) / 60);
      const s = gymWorkoutElapsed % 60;
      clock.textContent = (h > 0 ? `${h.toString().padStart(2, '0')}:` : '') +
        `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
  }, 1000);

  renderPage();
  showToast(`¡Entrenamiento iniciado: ${routine.name}! ⚔️`, 'info');
}

function startRestTimer(seconds = 90) {
  if (gymRestTimer) clearInterval(gymRestTimer);
  gymRestSecondsLeft = seconds;

  const updateDisplay = () => {
    const disp = document.getElementById('gym-rest-countdown');
    if (disp) {
      const m = Math.floor(gymRestSecondsLeft / 60).toString().padStart(2, '0');
      const s = (gymRestSecondsLeft % 60).toString().padStart(2, '0');
      disp.textContent = `${m}:${s}`;
    }
  };

  const card = document.getElementById('gym-rest-card');
  if (card) card.style.display = 'flex';
  updateDisplay();

  gymRestTimer = setInterval(() => {
    gymRestSecondsLeft--;
    updateDisplay();
    if (gymRestSecondsLeft <= 0) {
      clearInterval(gymRestTimer);
      gymRestTimer = null;
      playBeepChime();
      showToast('¡Descanso completado! A por la siguiente serie 🔥', 'success');
      const c = document.getElementById('gym-rest-card');
      if (c) c.style.display = 'none';
    }
  }, 1000);
}

async function finishActiveWorkout() {
  if (!gymActiveWorkout) return;

  clearInterval(gymWorkoutTimer);
  clearInterval(gymRestTimer);
  gymWorkoutTimer = null;
  gymRestTimer = null;

  const durationMin = Math.max(1, Math.round(gymWorkoutElapsed / 60));
  const notes = document.getElementById('workout-notes')?.value?.trim() || gymActiveWorkout.notes || '';

  let totalSets = 0;
  Object.values(gymActiveWorkout.exerciseStates).forEach(st => {
    totalSets += st.sets.filter(s => s.done).length;
  });

  const sessionData = {
    id: 's_' + Math.random().toString(36).substring(2, 9),
    user_id: currentUser?.id || 'local',
    routine_id: gymActiveWorkout.routineId,
    routine_name: gymActiveWorkout.routineName,
    date: todayStr(),
    duration_minutes: durationMin,
    notes: notes,
    created_at: new Date().toISOString(),
  };

  gymSessions.unshift(sessionData);
  persistGymLocal();

  if (currentUser) {
    try {
      await supabase.from('gym_sessions').insert({
        user_id: currentUser.id,
        routine_id: gymActiveWorkout.routineId,
        date: todayStr(),
        duration_minutes: durationMin,
        notes: notes,
      });
    } catch (e) {}
  }

  gymActiveWorkout = null;
  playBeepChime();
  showToast(`¡Sesión de Gym completada en ${durationMin} min! (${totalSets} series) ❄️💪`, 'success');
  renderPage();
}

async function deleteRoutine(routineId) {
  if (!confirm('¿Eliminar esta rutina y todos sus ejercicios?')) return;

  gymRoutines = gymRoutines.filter(r => r.id !== routineId);
  gymExercises = gymExercises.filter(e => e.routine_id !== routineId);
  persistGymLocal();

  if (currentUser) {
    try {
      await supabase.from('gym_routines').delete().eq('id', routineId);
    } catch (e) {}
  }

  showToast('Rutina eliminada', 'info');
  renderPage();
}

async function deleteGymSession(sessionId) {
  if (!confirm('¿Eliminar este registro de entrenamiento?')) return;

  gymSessions = gymSessions.filter(s => s.id !== sessionId);
  persistGymLocal();

  if (currentUser) {
    try {
      await supabase.from('gym_sessions').delete().eq('id', sessionId);
    } catch (e) {}
  }

  showToast('Sesión eliminada', 'info');
  renderPage();
}

// ─── ROUTINE MODAL (CREATE / EDIT) ───
function showRoutineModal(editRoutine = null) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const initialDays = editRoutine?.days ? (Array.isArray(editRoutine.days) ? editRoutine.days : editRoutine.days.split(',')) : ['Lun', 'Jue'];
  let selectedDays = [...initialDays];
  const routineExercisesList = editRoutine
    ? gymExercises.filter(e => e.routine_id === editRoutine.id)
    : [
        { name: 'Press de Banca Plano', sets: 4, reps: '8-10', weight: 70, rest_seconds: 120, notes: '' },
        { name: 'Press Inclinado con Mancuernas', sets: 3, reps: '10-12', weight: 24, rest_seconds: 90, notes: '' },
        { name: 'Elevaciones Laterales', sets: 4, reps: '15', weight: 12, rest_seconds: 60, notes: '' },
      ];

  let localExercises = routineExercisesList.map((ex, idx) => ({ ...ex, tempId: idx + 1 }));

  const renderExerciseRows = () => {
    return localExercises.map((ex, idx) => `
      <div class="exercise-edit-item" data-row-idx="${idx}">
        <div class="exercise-edit-grid">
          <div>
            <label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);display:block">Ejercicio</label>
            <input type="text" class="neu-input row-name" value="${ex.name || ''}" placeholder="Ej: Press de Banca" required />
          </div>
          <div>
            <label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);display:block">Series</label>
            <input type="number" class="neu-input row-sets" value="${ex.sets || 3}" min="1" max="15" />
          </div>
          <div>
            <label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);display:block">Reps</label>
            <input type="text" class="neu-input row-reps" value="${ex.reps || '10'}" placeholder="8-10" />
          </div>
          <div>
            <label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);display:block">Peso (kg)</label>
            <input type="number" step="0.5" class="neu-input row-weight" value="${ex.weight || 0}" />
          </div>
          <div>
            <label style="font-size:0.7rem;font-weight:700;color:var(--text-muted);display:block">Descanso (s)</label>
            <input type="number" class="neu-input row-rest" value="${ex.rest_seconds || 90}" min="10" max="600" />
          </div>
          <div style="padding-top:16px">
            <button type="button" class="neu-btn neu-btn--icon-sm row-del-btn" title="Quitar">
              ${icon('trash', { size: 14 })}
            </button>
          </div>
        </div>
      </div>
    `).join('');
  };

  backdrop.innerHTML = `
    <div class="modal-content" style="max-width:680px">
      <h2 style="font-size:1.25rem;font-weight:800;margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px">
        ${icon('dumbbell', { size: 22 })} ${editRoutine ? 'Editar Rutina' : 'Nueva Rutina de Gym'}
      </h2>

      <form id="routine-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="routine-name">Nombre de la Rutina</label>
          <input type="text" id="routine-name" class="neu-input" placeholder="Ej: Empuje / Push Day" required value="${editRoutine?.name || ''}" />
        </div>

        <div class="neu-input-wrapper">
          <label for="routine-desc">Descripción o Enfoque</label>
          <input type="text" id="routine-desc" class="neu-input" placeholder="Ej: Pecho, Hombro anterior y lateral, Tríceps" value="${editRoutine?.description || ''}" />
        </div>

        <div class="neu-input-wrapper">
          <label>Días asignados</label>
          <div class="day-picker">
            ${[{k:'Lun',l:'L'},{k:'Mar',l:'M'},{k:'Mié',l:'X'},{k:'Jue',l:'J'},{k:'Vie',l:'V'},{k:'Sáb',l:'S'},{k:'Dom',l:'D'}]
              .map(d => `<button type="button" class="day-btn ${selectedDays.includes(d.k) ? 'day-btn--active' : ''}" data-rday="${d.k}">${d.l}</button>`)
              .join('')}
          </div>
        </div>

        <!-- Exercises Section -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm)">
            <label style="font-size:0.85rem;font-weight:700;color:var(--text-secondary)">Ejercicios de la Rutina</label>
            <button type="button" class="neu-btn neu-btn--sm" id="modal-add-exercise-btn">
              ${icon('plus', { size: 14 })} Añadir Ejercicio
            </button>
          </div>
          <div class="exercise-edit-list" id="modal-exercises-container">
            ${renderExerciseRows()}
          </div>
        </div>

        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button type="button" class="neu-btn" id="routine-cancel">Cancelar</button>
          <button type="submit" class="neu-btn neu-btn--primary">${editRoutine ? 'Guardar Cambios' : 'Crear Rutina'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Day buttons listener
  backdrop.querySelectorAll('[data-rday]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.rday;
      selectedDays = selectedDays.includes(d) ? selectedDays.filter(x => x !== d) : [...selectedDays, d];
      btn.classList.toggle('day-btn--active', selectedDays.includes(d));
    });
  });

  // Re-attach exercise rows logic
  const attachRowListeners = () => {
    const listEl = document.getElementById('modal-exercises-container');
    listEl.querySelectorAll('.exercise-edit-item').forEach((item, idx) => {
      item.querySelector('.row-del-btn')?.addEventListener('click', () => {
        localExercises.splice(idx, 1);
        listEl.innerHTML = renderExerciseRows();
        attachRowListeners();
      });
      item.querySelector('.row-name')?.addEventListener('input', (e) => { localExercises[idx].name = e.target.value; });
      item.querySelector('.row-sets')?.addEventListener('input', (e) => { localExercises[idx].sets = parseInt(e.target.value) || 3; });
      item.querySelector('.row-reps')?.addEventListener('input', (e) => { localExercises[idx].reps = e.target.value; });
      item.querySelector('.row-weight')?.addEventListener('input', (e) => { localExercises[idx].weight = parseFloat(e.target.value) || 0; });
      item.querySelector('.row-rest')?.addEventListener('input', (e) => { localExercises[idx].rest_seconds = parseInt(e.target.value) || 90; });
    });
  };

  attachRowListeners();

  // Add exercise button in modal
  document.getElementById('modal-add-exercise-btn')?.addEventListener('click', () => {
    localExercises.push({ name: '', sets: 3, reps: '10', weight: 0, rest_seconds: 90, notes: '' });
    const listEl = document.getElementById('modal-exercises-container');
    listEl.innerHTML = renderExerciseRows();
    attachRowListeners();
  });

  document.getElementById('routine-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  // Form submit
  document.getElementById('routine-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('routine-name').value.trim();
    const description = document.getElementById('routine-desc').value.trim();

    if (!name) return;

    const validExercises = localExercises.filter(ex => ex.name && ex.name.trim());
    if (validExercises.length === 0) {
      showToast('Añade al menos un ejercicio a la rutina', 'error');
      return;
    }

    let routineId = editRoutine?.id;

    if (editRoutine) {
      const idx = gymRoutines.findIndex(r => r.id === editRoutine.id);
      if (idx >= 0) {
        gymRoutines[idx] = {
          ...gymRoutines[idx],
          name,
          description,
          days: selectedDays,
        };
      }

      if (currentUser) {
        try {
          await supabase.from('gym_routines').update({ name, description, days: selectedDays }).eq('id', editRoutine.id);
        } catch (err) {}
      }
    } else {
      routineId = 'r_' + Math.random().toString(36).substring(2, 9);
      const newRoutine = {
        id: routineId,
        user_id: currentUser?.id || 'local',
        name,
        description,
        days: selectedDays,
        color: '#6366f1',
        created_at: new Date().toISOString(),
      };
      gymRoutines.push(newRoutine);

      if (currentUser) {
        try {
          const { data } = await supabase.from('gym_routines').insert({
            user_id: currentUser.id,
            name,
            description,
            days: selectedDays,
            color: '#6366f1',
          }).select().single();
          if (data) {
            routineId = data.id;
            newRoutine.id = data.id;
          }
        } catch (err) {}
      }
    }

    // Replace exercises for this routine
    gymExercises = gymExercises.filter(ex => ex.routine_id !== routineId);

    const newExs = validExercises.map((ex, idx) => ({
      id: 'e_' + Math.random().toString(36).substring(2, 9),
      routine_id: routineId,
      user_id: currentUser?.id || 'local',
      name: ex.name.trim(),
      sets: ex.sets || 3,
      reps: ex.reps || '10',
      weight: ex.weight || 0,
      rest_seconds: ex.rest_seconds || 90,
      notes: ex.notes || '',
      sort_order: idx,
      created_at: new Date().toISOString(),
    }));

    gymExercises.push(...newExs);
    persistGymLocal();

    if (currentUser) {
      try {
        await supabase.from('gym_exercises').delete().eq('routine_id', routineId);
        await supabase.from('gym_exercises').insert(newExs.map(ex => ({
          routine_id: routineId,
          user_id: currentUser.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          rest_seconds: ex.rest_seconds,
          sort_order: ex.sort_order,
        })));
      } catch (err) {}
    }

    backdrop.remove();
    showToast(editRoutine ? 'Rutina actualizada' : '¡Rutina creada con éxito! 💪', 'success');
    renderPage();
  });
}

// ─── AGENDA & ACADEMIA PAGE ───
function getExamCountdownInfo(dateStr) {
  const today = new Date(todayStr() + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: 'Realizado', badgeClass: 'countdown-badge--safe', isUrgent: false, days: diffDays };
  }
  if (diffDays === 0) {
    return { text: '¡HOY!', badgeClass: 'countdown-badge--urgent', isUrgent: true, days: 0 };
  }
  if (diffDays === 1) {
    return { text: '¡Mañana!', badgeClass: 'countdown-badge--urgent', isUrgent: true, days: 1 };
  }
  if (diffDays <= 3) {
    return { text: `Faltan ${diffDays} días`, badgeClass: 'countdown-badge--urgent', isUrgent: true, days: diffDays };
  }
  if (diffDays <= 7) {
    return { text: `En ${diffDays} días`, badgeClass: 'countdown-badge--warning', isUrgent: false, days: diffDays };
  }
  return { text: `En ${diffDays} días`, badgeClass: 'countdown-badge--safe', isUrgent: false, days: diffDays };
}

function renderAgendaPage(container) {
  const pendingTasks = agendaTasks.filter(t => t.status !== 'completed');
  const completedTasks = agendaTasks.filter(t => t.status === 'completed');
  const totalTasks = agendaTasks.length;
  const taskPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

  // Filter tasks based on current filters
  let filteredTasks = [...agendaTasks];
  if (agendaFilterSubject !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.subject_id === agendaFilterSubject);
  }
  if (agendaFilterStatus === 'pending') {
    filteredTasks = filteredTasks.filter(t => t.status !== 'completed');
  } else if (agendaFilterStatus === 'completed') {
    filteredTasks = filteredTasks.filter(t => t.status === 'completed');
  }

  // Sort upcoming exams
  const sortedExams = [...agendaExams].sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = `
    <div class="tab-content">
      <!-- Page Header -->
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md)">
        <div>
          <h1 class="page-header__title">
            ${icon('academic', { size: 28 })} Agenda & Academia
          </h1>
          <p class="page-header__subtitle">Gestión de deberes, exámenes con cuenta atrás y temarios sin depender de un servidor</p>
        </div>
        <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap">
          <button class="neu-btn" id="agenda-add-subj-btn">
            ${icon('plus', { size: 16 })} Asignatura
          </button>
          <button class="neu-btn" id="agenda-add-exam-btn">
            ${icon('timer', { size: 16 })} Examen
          </button>
          <button class="neu-btn neu-btn--primary" id="agenda-add-task-btn">
            ${icon('plus', { size: 18 })} Deberes / Tarea
          </button>
        </div>
      </div>

      <!-- Navigation Sub-tabs -->
      <div class="chip-group" style="margin-bottom:var(--space-lg)">
        <span class="chip ${agendaTab === 'overview' ? 'chip--active' : ''}" data-agenda-tab="overview">
          ${icon('target', { size: 15 })} Visión General
        </span>
        <span class="chip ${agendaTab === 'exams' ? 'chip--active' : ''}" data-agenda-tab="exams">
          ${icon('timer', { size: 15 })} Exámenes (${agendaExams.length})
        </span>
        <span class="chip ${agendaTab === 'tasks' ? 'chip--active' : ''}" data-agenda-tab="tasks">
          ${icon('check', { size: 15 })} Deberes & Entregas (${pendingTasks.length} pendientes)
        </span>
        <span class="chip ${agendaTab === 'subjects' ? 'chip--active' : ''}" data-agenda-tab="subjects">
          ${icon('book', { size: 15 })} Asignaturas & Apuntes (${agendaSubjects.length})
        </span>
      </div>

      <!-- Tab Content: OVERVIEW (WIDGETS) -->
      ${agendaTab === 'overview' ? `
        <div class="agenda-widgets-grid">
          <!-- Widget 1: Próximos Exámenes & Cuenta Atrás -->
          <div class="neu-card agenda-widget">
            <div class="agenda-widget__header">
              <h2 class="agenda-widget__title">
                ${icon('timer', { size: 20 })} Próximos Exámenes
              </h2>
              <span class="neu-badge neu-badge--info">${agendaExams.length}</span>
            </div>
            ${sortedExams.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-lg)">
                <div class="empty-state__icon" style="width:48px;height:48px">${icon('timer', { size: 24 })}</div>
                <div class="empty-state__text" style="font-size:0.92rem">Sin exámenes próximos</div>
                <div class="empty-state__hint">¡Tiempo ideal para avanzar temario!</div>
              </div>
            ` : sortedExams.slice(0, 3).map(ex => {
              const subj = agendaSubjects.find(s => s.id === ex.subject_id);
              const cd = getExamCountdownInfo(ex.date);
              return `
                <div class="exam-card">
                  <div class="exam-card__top">
                    <div>
                      <div class="exam-card__title">${ex.title}</div>
                      ${subj ? `
                        <div class="subject-tag" style="margin-top:6px">
                          <span class="subject-tag__dot" style="background:${subj.color || '#38bdf8'}"></span>
                          <span>${subj.name}</span>
                        </div>
                      ` : ''}
                    </div>
                    <span class="countdown-badge ${cd.badgeClass}">${cd.text}</span>
                  </div>
                  <div class="exam-card__meta">
                    <span>📅 ${formatDate(ex.date)} ${ex.time ? '• ⏰ ' + ex.time : ''}</span>
                    ${ex.location ? `<span>📍 ${ex.location}</span>` : ''}
                    ${ex.weight_percent ? `<span>⚖️ ${ex.weight_percent}%</span>` : ''}
                  </div>
                  ${ex.syllabus ? `
                    <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:6px;font-style:italic">
                      📖 ${ex.syllabus}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
            ${sortedExams.length > 3 ? `
              <div style="text-align:right;margin-top:var(--space-xs)">
                <a href="#" class="btn-link" data-switch-to="exams" style="font-size:0.8rem;color:#38bdf8;font-weight:700">Ver todos (${sortedExams.length}) →</a>
              </div>
            ` : ''}
          </div>

          <!-- Widget 2: Deberes & Entregas de la Semana -->
          <div class="neu-card agenda-widget">
            <div class="agenda-widget__header">
              <h2 class="agenda-widget__title">
                ${icon('check', { size: 20 })} Deberes & Tareas
              </h2>
              <span class="neu-badge neu-badge--warning">${pendingTasks.length} pendientes</span>
            </div>
            ${pendingTasks.length === 0 ? `
              <div class="empty-state" style="padding:var(--space-lg)">
                <div class="empty-state__icon" style="width:48px;height:48px">${icon('check', { size: 24 })}</div>
                <div class="empty-state__text" style="font-size:0.92rem">¡Al día con las tareas!</div>
                <div class="empty-state__hint">No tienes deberes pendientes ahora mismo</div>
              </div>
            ` : pendingTasks.slice(0, 4).map(t => {
              const subj = agendaSubjects.find(s => s.id === t.subject_id);
              const isToday = t.due_date === todayStr();
              return `
                <div class="task-row">
                  <div class="task-row__left">
                    <button class="set-check-btn" data-toggle-task="${t.id}" title="Marcar como entregado">
                      ${icon('check', { size: 16 })}
                    </button>
                    <div style="min-width:0">
                      <div class="task-row__title" title="${t.title}">${t.title}</div>
                      <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap">
                        ${subj ? `
                          <span style="font-size:0.7rem;font-weight:700;color:${subj.color || 'var(--text-muted)'}">${subj.code || subj.name}</span>
                        ` : ''}
                        <span style="font-size:0.72rem;color:${isToday ? 'var(--accent-danger)' : 'var(--text-muted)'};font-weight:${isToday ? '800' : '600'}">
                          ${isToday ? '⚠️ ¡Hoy!' : formatDate(t.due_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="task-row__right">
                    <span class="priority-badge priority-badge--${t.priority || 'medium'}">${t.priority || 'media'}</span>
                  </div>
                </div>
              `;
            }).join('')}
            ${pendingTasks.length > 4 ? `
              <div style="text-align:right;margin-top:var(--space-xs)">
                <a href="#" class="btn-link" data-switch-to="tasks" style="font-size:0.8rem;color:#38bdf8;font-weight:700">Ver todas las tareas →</a>
              </div>
            ` : ''}
          </div>

          <!-- Widget 3: Progreso & Multitarea -->
          <div class="neu-card agenda-widget">
            <div class="agenda-widget__header">
              <h2 class="agenda-widget__title">
                ${icon('chart', { size: 20 })} Rendimiento Académico
              </h2>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);margin-bottom:var(--space-md)">
              <div style="padding:var(--space-md);background:var(--bg-secondary);border-radius:var(--radius-sm);text-align:center;box-shadow:var(--neu-shadow-inset-sm)">
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Tareas Listas</div>
                <div style="font-size:1.6rem;font-weight:800;color:var(--accent-success);margin-top:4px">${completedTasks.length} / ${totalTasks}</div>
              </div>
              <div style="padding:var(--space-md);background:var(--bg-secondary);border-radius:var(--radius-sm);text-align:center;box-shadow:var(--neu-shadow-inset-sm)">
                <div style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase">Asignaturas</div>
                <div style="font-size:1.6rem;font-weight:800;color:#38bdf8;margin-top:4px">${agendaSubjects.length}</div>
              </div>
            </div>

            <div style="margin-bottom:var(--space-sm)">
              <div style="display:flex;justify-content:space-between;font-size:0.8rem;font-weight:700;color:var(--text-secondary);margin-bottom:4px">
                <span>Completitud de Deberes</span>
                <span>${taskPercent}%</span>
              </div>
              <div class="neu-progress">
                <div class="neu-progress__fill" style="width:${taskPercent}%"></div>
              </div>
            </div>

            <div style="margin-top:var(--space-md);padding:var(--space-sm);background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:0.8rem;color:var(--text-secondary);box-shadow:var(--neu-shadow-inset-sm)">
              💡 <strong>Enfoque Winter Arc:</strong> Usa bloques de <strong>Deep Work</strong> de 50 min para preparar las tareas de alta prioridad sin distracciones.
            </div>
          </div>
        </div>

        <!-- Subjects Quick Access Banner -->
        <div class="neu-card" style="margin-top:var(--space-lg)">
          <div class="neu-card__header">
            <h2 class="neu-card__title">${icon('folder', { size: 20 })} Acceso Rápido a Apuntes & Carpetas</h2>
            <button class="neu-btn neu-btn--sm" data-switch-to="subjects">Ver todas</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:var(--space-md)">
            ${agendaSubjects.map(s => {
              const files = agendaFiles.filter(f => f.subject_id === s.id);
              let storageLabel = '📁 Local (PC)';
              let storageClass = 'storage-pill--local';
              if (s.storage_type === 'gdrive') { storageLabel = '☁️ Google Drive'; storageClass = 'storage-pill--gdrive'; }
              if (s.storage_type === 'onedrive') { storageLabel = '☁️ OneDrive'; storageClass = 'storage-pill--onedrive'; }
              return `
                <div class="file-item">
                  <div class="file-item__info">
                    <span class="subject-tag__dot" style="background:${s.color || '#38bdf8'};width:12px;height:12px"></span>
                    <div>
                      <div class="file-item__name">${s.name}</div>
                      <span class="storage-pill ${storageClass}" style="margin-top:4px">${storageLabel}</span>
                    </div>
                  </div>
                  <button class="neu-btn neu-btn--sm" data-open-subject-files="${s.id}">
                    ${icon('folder', { size: 14 })} ${files.length} apuntes
                  </button>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Tab Content: EXAMS -->
      ${agendaTab === 'exams' ? `
        <div class="neu-card">
          <div class="neu-card__header">
            <h2 class="neu-card__title">${icon('timer', { size: 22 })} Calendario & Exámenes Programados</h2>
            <button class="neu-btn neu-btn--primary" id="exams-tab-add-btn">
              ${icon('plus', { size: 16 })} Nuevo Examen
            </button>
          </div>
          ${agendaExams.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state__icon">${icon('timer', { size: 36 })}</div>
              <div class="empty-state__text">Sin exámenes programados</div>
              <div class="empty-state__hint">Añade los parciales y entregas finales para activar la cuenta atrás</div>
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:var(--space-md)">
              ${sortedExams.map(ex => {
                const subj = agendaSubjects.find(s => s.id === ex.subject_id);
                const cd = getExamCountdownInfo(ex.date);
                return `
                  <div class="exam-card" style="padding:var(--space-lg)">
                    <div class="exam-card__top">
                      <div>
                        <div style="font-size:1.15rem;font-weight:800;color:var(--text-primary)">${ex.title}</div>
                        ${subj ? `
                          <div class="subject-tag" style="margin-top:6px">
                            <span class="subject-tag__dot" style="background:${subj.color || '#38bdf8'}"></span>
                            <span>${subj.name} (${subj.code || 'ASIG'})</span>
                          </div>
                        ` : ''}
                      </div>
                      <div style="display:flex;align-items:center;gap:8px">
                        <span class="countdown-badge ${cd.badgeClass}" style="font-size:0.85rem">${cd.text}</span>
                        <button class="neu-btn neu-btn--icon-sm" data-edit-exam="${ex.id}" title="Editar">
                          ${icon('edit', { size: 14 })}
                        </button>
                        <button class="neu-btn neu-btn--icon-sm" data-delete-exam="${ex.id}" title="Eliminar">
                          ${icon('trash', { size: 14 })}
                        </button>
                      </div>
                    </div>

                    <div class="exam-card__meta" style="margin-top:10px;font-size:0.85rem">
                      <span>📅 <strong>Fecha:</strong> ${formatDate(ex.date)}</span>
                      ${ex.time ? `<span>⏰ <strong>Hora:</strong> ${ex.time}</span>` : ''}
                      ${ex.location ? `<span>📍 <strong>Lugar / Aula:</strong> ${ex.location}</span>` : ''}
                      ${ex.weight_percent ? `<span>⚖️ <strong>Ponderación:</strong> ${ex.weight_percent}%</span>` : ''}
                    </div>

                    ${ex.syllabus ? `
                      <div style="margin-top:10px;padding:var(--space-sm) var(--space-md);background:var(--bg-card);border-radius:var(--radius-xs);border:1px solid var(--border-subtle)">
                        <span style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);display:block">Temario a evaluar:</span>
                        <div style="font-size:0.85rem;color:var(--text-primary);margin-top:2px">${ex.syllabus}</div>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      ` : ''}

      <!-- Tab Content: TASKS (DEBERES) -->
      ${agendaTab === 'tasks' ? `
        <div class="neu-card">
          <!-- Filter Controls -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-md);margin-bottom:var(--space-lg)">
            <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap;align-items:center">
              <span style="font-size:0.8rem;font-weight:700;color:var(--text-muted)">Filtrar:</span>
              <select id="tasks-filter-subj" class="neu-input" style="padding:4px 10px;font-size:0.82rem;width:auto">
                <option value="all" ${agendaFilterSubject === 'all' ? 'selected' : ''}>Todas las asignaturas</option>
                ${agendaSubjects.map(s => `<option value="${s.id}" ${agendaFilterSubject === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
              </select>
              <select id="tasks-filter-status" class="neu-input" style="padding:4px 10px;font-size:0.82rem;width:auto">
                <option value="all" ${agendaFilterStatus === 'all' ? 'selected' : ''}>Todos los estados</option>
                <option value="pending" ${agendaFilterStatus === 'pending' ? 'selected' : ''}>Solo pendientes</option>
                <option value="completed" ${agendaFilterStatus === 'completed' ? 'selected' : ''}>Solo completados</option>
              </select>
            </div>
            <button class="neu-btn neu-btn--primary" id="tasks-tab-add-btn">
              ${icon('plus', { size: 16 })} Nueva Tarea
            </button>
          </div>

          <!-- Tasks List -->
          ${filteredTasks.length === 0 ? `
            <div class="empty-state">
              <div class="empty-state__icon">${icon('check', { size: 36 })}</div>
              <div class="empty-state__text">No hay tareas que mostrar con estos filtros</div>
            </div>
          ` : `
            <div>
              ${filteredTasks.map(t => {
                const subj = agendaSubjects.find(s => s.id === t.subject_id);
                const isDone = t.status === 'completed';
                return `
                  <div class="task-row ${isDone ? 'task-row--done' : ''}">
                    <div class="task-row__left">
                      <button class="set-check-btn ${isDone ? 'set-check-btn--done' : ''}" data-toggle-task="${t.id}" title="${isDone ? 'Marcar pendiente' : 'Marcar completado'}">
                        ${icon('check', { size: 18 })}
                      </button>
                      <div style="min-width:0">
                        <div class="task-row__title" title="${t.title}">${t.title}</div>
                        ${t.description ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px">${t.description}</div>` : ''}
                        <div style="display:flex;align-items:center;gap:8px;margin-top:4px;flex-wrap:wrap">
                          ${subj ? `
                            <span class="subject-tag">
                              <span class="subject-tag__dot" style="background:${subj.color || '#38bdf8'}"></span>
                              <span>${subj.name}</span>
                            </span>
                          ` : ''}
                          <span style="font-size:0.75rem;color:var(--text-muted)">
                            📅 ${formatDate(t.due_date)} ${t.due_time ? '⏰ ' + t.due_time : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div class="task-row__right">
                      <span class="priority-badge priority-badge--${t.priority || 'medium'}">${t.priority || 'media'}</span>
                      <button class="neu-btn neu-btn--icon-sm" data-edit-task="${t.id}" title="Editar">
                        ${icon('edit', { size: 14 })}
                      </button>
                      <button class="neu-btn neu-btn--icon-sm" data-delete-task="${t.id}" title="Eliminar">
                        ${icon('trash', { size: 14 })}
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      ` : ''}

      <!-- Tab Content: SUBJECTS & NOTES -->
      ${agendaTab === 'subjects' ? `
        <div>
          <div class="subjects-grid">
            ${agendaSubjects.map(s => {
              const files = agendaFiles.filter(f => f.subject_id === s.id);
              const tasks = agendaTasks.filter(t => t.subject_id === s.id);
              const exams = agendaExams.filter(e => e.subject_id === s.id);

              let storageLabel = '📁 Carpeta Local (PC)';
              let storageClass = 'storage-pill--local';
              let storageIcon = 'hardDrive';
              if (s.storage_type === 'gdrive') {
                storageLabel = '☁️ Google Drive';
                storageClass = 'storage-pill--gdrive';
                storageIcon = 'cloud';
              } else if (s.storage_type === 'onedrive') {
                storageLabel = '☁️ OneDrive';
                storageClass = 'storage-pill--onedrive';
                storageIcon = 'cloud';
              }

              return `
                <div class="neu-card subject-card">
                  <div class="subject-card__color-bar" style="background:${s.color || '#38bdf8'}"></div>
                  <div>
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-sm)">
                      <div>
                        <h2 style="font-size:1.15rem;font-weight:800;color:var(--text-primary)">${s.name}</h2>
                        <span class="neu-badge neu-badge--info" style="margin-top:4px">${s.code || 'ASIG'}</span>
                      </div>
                      <div style="display:flex;gap:4px">
                        <button class="neu-btn neu-btn--icon-sm" data-edit-subject="${s.id}" title="Editar Asignatura">
                          ${icon('edit', { size: 14 })}
                        </button>
                        <button class="neu-btn neu-btn--icon-sm" data-delete-subject="${s.id}" title="Eliminar Asignatura">
                          ${icon('trash', { size: 14 })}
                        </button>
                      </div>
                    </div>

                    ${s.professor ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:4px">👨‍🏫 ${s.professor}</div>` : ''}
                    ${s.schedule ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:var(--space-md)">🕒 ${s.schedule}</div>` : ''}

                    <!-- Storage Badge -->
                    <div style="margin-bottom:var(--space-md)">
                      <span class="storage-pill ${storageClass}">
                        ${icon(storageIcon, { size: 13 })} ${storageLabel}
                      </span>
                      ${s.local_folder_name ? `
                        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:3px">📂 ${s.local_folder_name}</div>
                      ` : ''}
                    </div>

                    <!-- Mini Stats -->
                    <div style="display:flex;gap:12px;font-size:0.8rem;color:var(--text-secondary);margin-bottom:var(--space-lg);background:var(--bg-secondary);padding:var(--space-sm);border-radius:var(--radius-xs);box-shadow:var(--neu-shadow-inset-sm)">
                      <span>📝 ${tasks.length} deberes</span>
                      <span>🎯 ${exams.length} exámenes</span>
                      <span>📑 ${files.length} apuntes</span>
                    </div>
                  </div>

                  <div style="display:flex;gap:var(--space-sm);justify-content:space-between;align-items:center;border-top:1px solid var(--border-subtle);padding-top:var(--space-sm)">
                    ${s.storage_link ? `
                      <a href="${s.storage_link}" target="_blank" rel="noopener noreferrer" class="neu-btn neu-btn--sm" title="Abrir enlace de nube">
                        ${icon('externalLink', { size: 14 })} Abrir Nube
                      </a>
                    ` : '<span></span>'}
                    <button class="neu-btn neu-btn--primary" data-open-subject-files="${s.id}">
                      ${icon('folder', { size: 16 })} Apuntes & Temario
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  // Listeners for tabs
  container.querySelectorAll('[data-agenda-tab]').forEach(t => {
    t.addEventListener('click', () => {
      agendaTab = t.dataset.agendaTab;
      renderAgendaPage(container);
    });
  });

  // Switch to tabs from shortcuts
  container.querySelectorAll('[data-switch-to]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      agendaTab = link.dataset.switchTo;
      renderAgendaPage(container);
    });
  });

  // Action buttons
  document.getElementById('agenda-add-subj-btn')?.addEventListener('click', () => showSubjectModal());
  document.getElementById('agenda-add-exam-btn')?.addEventListener('click', () => showExamModal());
  document.getElementById('agenda-add-task-btn')?.addEventListener('click', () => showTaskModal());
  document.getElementById('exams-tab-add-btn')?.addEventListener('click', () => showExamModal());
  document.getElementById('tasks-tab-add-btn')?.addEventListener('click', () => showTaskModal());

  // Task filter listeners
  document.getElementById('tasks-filter-subj')?.addEventListener('change', (e) => {
    agendaFilterSubject = e.target.value;
    renderAgendaPage(container);
  });
  document.getElementById('tasks-filter-status')?.addEventListener('change', (e) => {
    agendaFilterStatus = e.target.value;
    renderAgendaPage(container);
  });

  // Toggle task complete
  container.querySelectorAll('[data-toggle-task]').forEach(btn => {
    btn.addEventListener('click', () => toggleAgendaTaskStatus(btn.dataset.toggleTask));
  });

  // Edit / Delete Tasks
  container.querySelectorAll('[data-edit-task]').forEach(btn => {
    btn.addEventListener('click', () => {
      const task = agendaTasks.find(t => t.id === btn.dataset.editTask);
      if (task) showTaskModal(task);
    });
  });
  container.querySelectorAll('[data-delete-task]').forEach(btn => {
    btn.addEventListener('click', () => deleteAgendaTask(btn.dataset.deleteTask));
  });

  // Edit / Delete Exams
  container.querySelectorAll('[data-edit-exam]').forEach(btn => {
    btn.addEventListener('click', () => {
      const exam = agendaExams.find(e => e.id === btn.dataset.editExam);
      if (exam) showExamModal(exam);
    });
  });
  container.querySelectorAll('[data-delete-exam]').forEach(btn => {
    btn.addEventListener('click', () => deleteAgendaExam(btn.dataset.deleteExam));
  });

  // Edit / Delete Subjects
  container.querySelectorAll('[data-edit-subject]').forEach(btn => {
    btn.addEventListener('click', () => {
      const subj = agendaSubjects.find(s => s.id === btn.dataset.editSubject);
      if (subj) showSubjectModal(subj);
    });
  });
  container.querySelectorAll('[data-delete-subject]').forEach(btn => {
    btn.addEventListener('click', () => deleteAgendaSubject(btn.dataset.deleteSubject));
  });

  // Open Subject Files Hub Modal
  container.querySelectorAll('[data-open-subject-files]').forEach(btn => {
    btn.addEventListener('click', () => {
      const subj = agendaSubjects.find(s => s.id === btn.dataset.openSubjectFiles);
      if (subj) showSubjectFilesModal(subj);
    });
  });
}

// ─── TASK ACTIONS ───
function toggleAgendaTaskStatus(taskId) {
  const task = agendaTasks.find(t => t.id === taskId);
  if (!task) return;
  task.status = task.status === 'completed' ? 'pending' : 'completed';
  persistAgendaLocal();
  if (task.status === 'completed') {
    playBeepChime();
    showToast('¡Tarea completada con éxito! 🎉', 'success');
  } else {
    showToast('Tarea reabierta', 'info');
  }
  renderPage();
}

function deleteAgendaTask(taskId) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  agendaTasks = agendaTasks.filter(t => t.id !== taskId);
  persistAgendaLocal();
  showToast('Tarea eliminada', 'info');
  renderPage();
}

function deleteAgendaExam(examId) {
  if (!confirm('¿Eliminar este examen de la agenda?')) return;
  agendaExams = agendaExams.filter(e => e.id !== examId);
  persistAgendaLocal();
  showToast('Examen eliminado', 'info');
  renderPage();
}

function deleteAgendaSubject(subjectId) {
  if (!confirm('¿Eliminar esta asignatura y todas sus tareas/exámenes asociados?')) return;
  agendaSubjects = agendaSubjects.filter(s => s.id !== subjectId);
  agendaTasks = agendaTasks.filter(t => t.subject_id !== subjectId);
  agendaExams = agendaExams.filter(e => e.subject_id !== subjectId);
  agendaFiles = agendaFiles.filter(f => f.subject_id !== subjectId);
  persistAgendaLocal();
  showToast('Asignatura eliminada', 'info');
  renderPage();
}

// ─── SUBJECT MODAL ───
function showSubjectModal(editSubject = null) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const defaultColors = ['#38bdf8', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];
  let selectedColor = editSubject?.color || '#38bdf8';
  let selectedStorage = editSubject?.storage_type || 'local';

  backdrop.innerHTML = `
    <div class="modal-content" style="max-width:560px">
      <h2 style="font-size:1.25rem;font-weight:800;margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px">
        ${icon('academic', { size: 22 })} ${editSubject ? 'Editar Asignatura' : 'Nueva Asignatura / Proyecto'}
      </h2>
      <form id="subject-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="subj-name">Nombre de la Asignatura o Proyecto</label>
          <input type="text" id="subj-name" class="neu-input" placeholder="Ej: Matemáticas Discretas" required value="${editSubject?.name || ''}" />
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm)">
          <div class="neu-input-wrapper">
            <label for="subj-code">Código / Abreviatura</label>
            <input type="text" id="subj-code" class="neu-input" placeholder="Ej: MAT" value="${editSubject?.code || ''}" />
          </div>
          <div class="neu-input-wrapper">
            <label for="subj-prof">Profesor / Tutor</label>
            <input type="text" id="subj-prof" class="neu-input" placeholder="Ej: Dra. Ramos" value="${editSubject?.professor || ''}" />
          </div>
        </div>

        <div class="neu-input-wrapper">
          <label for="subj-sched">Horario / Días de clase</label>
          <input type="text" id="subj-sched" class="neu-input" placeholder="Ej: Mar & Jue 11:30 - 13:30" value="${editSubject?.schedule || ''}" />
        </div>

        <!-- Color selector -->
        <div class="neu-input-wrapper">
          <label>Color Identificador</label>
          <div class="note-colors" id="subj-colors">
            ${defaultColors.map(c => `
              <div class="note-color-dot ${selectedColor === c ? 'note-color-dot--active' : ''}" style="background:${c}" data-color="${c}"></div>
            `).join('')}
          </div>
        </div>

        <!-- Storage Preference -->
        <div class="neu-input-wrapper">
          <label>Almacenamiento de Apuntes Preferido</label>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-xs);margin-top:4px">
            <div class="storage-choice-card ${selectedStorage === 'local' ? 'storage-choice-card--active' : ''}" data-storage="local" style="text-align:center;padding:var(--space-sm)">
              ${icon('hardDrive', { size: 18 })}
              <div style="font-size:0.75rem;font-weight:700;margin-top:4px">Carpeta PC</div>
            </div>
            <div class="storage-choice-card ${selectedStorage === 'gdrive' ? 'storage-choice-card--active' : ''}" data-storage="gdrive" style="text-align:center;padding:var(--space-sm)">
              ${icon('cloud', { size: 18 })}
              <div style="font-size:0.75rem;font-weight:700;margin-top:4px">Google Drive</div>
            </div>
            <div class="storage-choice-card ${selectedStorage === 'onedrive' ? 'storage-choice-card--active' : ''}" data-storage="onedrive" style="text-align:center;padding:var(--space-sm)">
              ${icon('cloud', { size: 18 })}
              <div style="font-size:0.75rem;font-weight:700;margin-top:4px">OneDrive</div>
            </div>
          </div>
        </div>

        <div class="neu-input-wrapper" id="storage-link-box" style="display:${selectedStorage !== 'local' ? 'block' : 'none'}">
          <label for="subj-link">Enlace a la carpeta compartida en la nube</label>
          <input type="url" id="subj-link" class="neu-input" placeholder="https://drive.google.com/..." value="${editSubject?.storage_link || ''}" />
        </div>

        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button type="button" class="neu-btn" id="subj-cancel">Cancelar</button>
          <button type="submit" class="neu-btn neu-btn--primary">${editSubject ? 'Guardar Cambios' : 'Crear Asignatura'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Colors
  backdrop.querySelectorAll('[data-color]').forEach(el => {
    el.addEventListener('click', () => {
      backdrop.querySelectorAll('[data-color]').forEach(d => d.classList.remove('note-color-dot--active'));
      el.classList.add('note-color-dot--active');
      selectedColor = el.dataset.color;
    });
  });

  // Storage choice
  backdrop.querySelectorAll('[data-storage]').forEach(el => {
    el.addEventListener('click', () => {
      backdrop.querySelectorAll('[data-storage]').forEach(s => s.classList.remove('storage-choice-card--active'));
      el.classList.add('storage-choice-card--active');
      selectedStorage = el.dataset.storage;
      const linkBox = document.getElementById('storage-link-box');
      if (linkBox) linkBox.style.display = selectedStorage !== 'local' ? 'block' : 'none';
    });
  });

  document.getElementById('subj-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  document.getElementById('subject-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('subj-name').value.trim();
    const code = document.getElementById('subj-code').value.trim() || name.substring(0, 3).toUpperCase();
    const professor = document.getElementById('subj-prof').value.trim();
    const schedule = document.getElementById('subj-sched').value.trim();
    const storage_link = document.getElementById('subj-link')?.value?.trim() || '';

    if (!name) return;

    if (editSubject) {
      const idx = agendaSubjects.findIndex(s => s.id === editSubject.id);
      if (idx >= 0) {
        agendaSubjects[idx] = {
          ...agendaSubjects[idx],
          name, code, professor, schedule, color: selectedColor,
          storage_type: selectedStorage,
          storage_link,
        };
      }
      showToast('Asignatura actualizada', 'success');
    } else {
      agendaSubjects.push({
        id: 'subj_' + Math.random().toString(36).substring(2, 9),
        name, code, professor, schedule, color: selectedColor,
        storage_type: selectedStorage,
        storage_link,
        local_folder_name: null,
      });
      showToast('¡Asignatura añadida! 📚', 'success');
    }

    persistAgendaLocal();
    backdrop.remove();
    renderPage();
  });
}

// ─── TASK MODAL ───
function showTaskModal(editTask = null) {
  if (agendaSubjects.length === 0) {
    showToast('Crea primero una asignatura para asociar la tarea', 'info');
    showSubjectModal();
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal-content" style="max-width:540px">
      <h2 style="font-size:1.25rem;font-weight:800;margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px">
        ${icon('check', { size: 22 })} ${editTask ? 'Editar Deberes / Tarea' : 'Nueva Tarea / Entrega'}
      </h2>
      <form id="task-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="task-title">Título de la tarea o entrega</label>
          <input type="text" id="task-title" class="neu-input" placeholder="Ej: Práctica 3: Árboles Binarios" required value="${editTask?.title || ''}" />
        </div>

        <div class="neu-input-wrapper">
          <label for="task-subj">Asignatura</label>
          <select id="task-subj" class="neu-input" style="cursor:pointer" required>
            ${agendaSubjects.map(s => `
              <option value="${s.id}" ${editTask?.subject_id === s.id ? 'selected' : ''}>${s.name} (${s.code})</option>
            `).join('')}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm)">
          <div class="neu-input-wrapper">
            <label for="task-date">Fecha de entrega</label>
            <input type="date" id="task-date" class="neu-input" required value="${editTask?.due_date || todayStr()}" />
          </div>
          <div class="neu-input-wrapper">
            <label for="task-time">Hora límite</label>
            <input type="time" id="task-time" class="neu-input" value="${editTask?.due_time || '23:59'}" />
          </div>
        </div>

        <div class="neu-input-wrapper">
          <label for="task-priority">Prioridad</label>
          <select id="task-priority" class="neu-input" style="cursor:pointer">
            <option value="high" ${editTask?.priority === 'high' ? 'selected' : ''}>Alta 🔴</option>
            <option value="medium" ${editTask?.priority === 'medium' || !editTask ? 'selected' : ''}>Media 🟡</option>
            <option value="low" ${editTask?.priority === 'low' ? 'selected' : ''}>Baja ⚪</option>
          </select>
        </div>

        <div class="neu-input-wrapper">
          <label for="task-desc">Detalles o instrucciones adicionales</label>
          <textarea id="task-desc" class="neu-textarea" placeholder="Formato de entrega, pautas o notas...">${editTask?.description || ''}</textarea>
        </div>

        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button type="button" class="neu-btn" id="task-cancel">Cancelar</button>
          <button type="submit" class="neu-btn neu-btn--primary">${editTask ? 'Guardar Cambios' : 'Añadir a la Agenda'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.getElementById('task-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('task-title').value.trim();
    const subject_id = document.getElementById('task-subj').value;
    const due_date = document.getElementById('task-date').value;
    const due_time = document.getElementById('task-time').value;
    const priority = document.getElementById('task-priority').value;
    const description = document.getElementById('task-desc').value.trim();

    if (!title) return;

    if (editTask) {
      const idx = agendaTasks.findIndex(t => t.id === editTask.id);
      if (idx >= 0) {
        agendaTasks[idx] = {
          ...agendaTasks[idx],
          title, subject_id, due_date, due_time, priority, description,
        };
      }
      showToast('Tarea actualizada', 'success');
    } else {
      agendaTasks.push({
        id: 'task_' + Math.random().toString(36).substring(2, 9),
        title, subject_id, due_date, due_time, priority, description,
        status: 'pending',
      });
      showToast('Tarea registrada en tu agenda 📝', 'success');
    }

    persistAgendaLocal();
    backdrop.remove();
    renderPage();
  });
}

// ─── EXAM MODAL ───
function showExamModal(editExam = null) {
  if (agendaSubjects.length === 0) {
    showToast('Crea primero una asignatura para asociar el examen', 'info');
    showSubjectModal();
    return;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  backdrop.innerHTML = `
    <div class="modal-content" style="max-width:560px">
      <h2 style="font-size:1.25rem;font-weight:800;margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px">
        ${icon('timer', { size: 22 })} ${editExam ? 'Editar Examen' : 'Programar Nuevo Examen / Hito'}
      </h2>
      <form id="exam-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="exam-title">Título o Tipo de Examen</label>
          <input type="text" id="exam-title" class="neu-input" placeholder="Ej: Examen Parcial Temas 1 a 4" required value="${editExam?.title || ''}" />
        </div>

        <div class="neu-input-wrapper">
          <label for="exam-subj">Asignatura</label>
          <select id="exam-subj" class="neu-input" style="cursor:pointer" required>
            ${agendaSubjects.map(s => `
              <option value="${s.id}" ${editExam?.subject_id === s.id ? 'selected' : ''}>${s.name} (${s.code})</option>
            `).join('')}
          </select>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-sm)">
          <div class="neu-input-wrapper">
            <label for="exam-date">Fecha del examen</label>
            <input type="date" id="exam-date" class="neu-input" required value="${editExam?.date || todayStr()}" />
          </div>
          <div class="neu-input-wrapper">
            <label for="exam-time">Hora</label>
            <input type="time" id="exam-time" class="neu-input" value="${editExam?.time || '10:00'}" />
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:var(--space-sm)">
          <div class="neu-input-wrapper">
            <label for="exam-loc">Lugar / Aula o Enlace</label>
            <input type="text" id="exam-loc" class="neu-input" placeholder="Ej: Aula 2.4 - Campus Norte" value="${editExam?.location || ''}" />
          </div>
          <div class="neu-input-wrapper">
            <label for="exam-weight">Ponderación (%)</label>
            <input type="number" id="exam-weight" class="neu-input" placeholder="40" min="1" max="100" value="${editExam?.weight_percent || ''}" />
          </div>
        </div>

        <div class="neu-input-wrapper">
          <label for="exam-syl">Temario y Contenidos a Evaluar</label>
          <textarea id="exam-syl" class="neu-textarea" placeholder="Temas, capítulos o fórmulas clave que entran...">${editExam?.syllabus || ''}</textarea>
        </div>

        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button type="button" class="neu-btn" id="exam-cancel">Cancelar</button>
          <button type="submit" class="neu-btn neu-btn--primary">${editExam ? 'Guardar Cambios' : 'Fijar Examen'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.getElementById('exam-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  document.getElementById('exam-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('exam-title').value.trim();
    const subject_id = document.getElementById('exam-subj').value;
    const date = document.getElementById('exam-date').value;
    const time = document.getElementById('exam-time').value;
    const location = document.getElementById('exam-loc').value.trim();
    const weight_percent = parseInt(document.getElementById('exam-weight').value) || null;
    const syllabus = document.getElementById('exam-syl').value.trim();

    if (!title || !date) return;

    if (editExam) {
      const idx = agendaExams.findIndex(x => x.id === editExam.id);
      if (idx >= 0) {
        agendaExams[idx] = {
          ...agendaExams[idx],
          title, subject_id, date, time, location, weight_percent, syllabus,
        };
      }
      showToast('Examen actualizado', 'success');
    } else {
      agendaExams.push({
        id: 'exam_' + Math.random().toString(36).substring(2, 9),
        title, subject_id, date, time, location, weight_percent, syllabus,
        grade: null,
      });
      showToast('Examen fijado en tu agenda 🎯', 'success');
    }

    persistAgendaLocal();
    backdrop.remove();
    renderPage();
  });
}

// ─── SUBJECT FILES & STORAGE HUB MODAL ───
function showSubjectFilesModal(subject) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'Archivo externo';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getSubjectFiles = () => agendaFiles.filter(f => f.subject_id === subject.id);

  const renderFilesListHtml = () => {
    const list = getSubjectFiles();
    if (list.length === 0) {
      return `
        <div class="empty-state" style="padding:var(--space-md)">
          <div class="empty-state__icon" style="width:40px;height:40px">${icon('folder', { size: 20 })}</div>
          <div class="empty-state__text" style="font-size:0.9rem">Sin apuntes o temario subido aún</div>
          <div class="empty-state__hint">Sube archivos PDF/DOC o vincula una carpeta local / nube</div>
        </div>
      `;
    }
    return list.map(f => `
      <div class="file-item">
        <div class="file-item__info">
          <div class="file-item__icon">
            ${icon(f.storage_type === 'gdrive' || f.storage_type === 'onedrive' ? 'cloud' : 'file', { size: 18, color: subject.color || '#38bdf8' })}
          </div>
          <div>
            <div class="file-item__name" title="${f.title}">${f.title}</div>
            <div class="file-item__meta">
              ${f.storage_type === 'gdrive' ? 'Google Drive' : f.storage_type === 'onedrive' ? 'OneDrive' : 'Local (Navegador)'}
              • ${formatFileSize(f.file_size)}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:4px">
          ${f.url ? `
            <a href="${f.url}" target="_blank" rel="noopener noreferrer" class="neu-btn neu-btn--icon-sm" title="Abrir enlace">
              ${icon('externalLink', { size: 14 })}
            </a>
          ` : `
            <button class="neu-btn neu-btn--icon-sm" data-download-file="${f.id}" title="Descargar archivo">
              ${icon('download', { size: 14 })}
            </button>
          `}
          <button class="neu-btn neu-btn--icon-sm" data-delete-file="${f.id}" title="Quitar">
            ${icon('trash', { size: 14 })}
          </button>
        </div>
      </div>
    `).join('');
  };

  backdrop.innerHTML = `
    <div class="modal-content" style="max-width:680px">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-md);border-bottom:1px solid var(--border-subtle);padding-bottom:var(--space-sm)">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="subject-tag__dot" style="background:${subject.color || '#38bdf8'};width:14px;height:14px"></span>
            <h2 style="font-size:1.25rem;font-weight:800;color:var(--text-primary)">
              ${subject.name}
            </h2>
          </div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:2px">
            Almacenamiento de apuntes y temario — Sin depender de un servidor central
          </p>
        </div>
        <button class="neu-btn neu-btn--icon-sm" id="files-modal-close" title="Cerrar">
          ${icon('x', { size: 16 })}
        </button>
      </div>

      <!-- Storage Configuration Box -->
      <div class="neu-card" style="margin-bottom:var(--space-md);padding:var(--space-md);background:var(--bg-secondary);box-shadow:var(--neu-shadow-inset-sm)">
        <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);margin-bottom:8px">
          Conexión de Almacenamiento
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <span class="storage-pill ${subject.storage_type === 'gdrive' ? 'storage-pill--gdrive' : subject.storage_type === 'onedrive' ? 'storage-pill--onedrive' : 'storage-pill--local'}">
              ${icon(subject.storage_type === 'local' ? 'hardDrive' : 'cloud', { size: 13 })}
              ${subject.storage_type === 'gdrive' ? 'Google Drive' : subject.storage_type === 'onedrive' ? 'OneDrive' : 'Carpeta Local en tu PC'}
            </span>
            ${subject.local_folder_name ? `
              <div style="font-size:0.75rem;color:var(--text-primary);margin-top:4px">📂 Carpeta vinculada: <strong>${subject.local_folder_name}</strong></div>
            ` : ''}
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="neu-btn neu-btn--sm" id="pick-local-dir-btn">
              ${icon('hardDrive', { size: 14 })} Seleccionar Carpeta en PC
            </button>
            ${subject.storage_link ? `
              <a href="${subject.storage_link}" target="_blank" rel="noopener noreferrer" class="neu-btn neu-btn--sm" style="display:inline-flex;align-items:center;gap:4px">
                ${icon('externalLink', { size: 14 })} Abrir en Nube
              </a>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Upload or Add File Section -->
      <div style="display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-md);flex-wrap:wrap">
        <label class="neu-btn neu-btn--primary neu-btn--sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
          ${icon('upload', { size: 15 })} Subir Apunte / PDF local
          <input type="file" id="local-file-uploader" style="display:none" multiple accept=".pdf,.doc,.docx,.pptx,.xlsx,.txt,.png,.jpg,.jpeg,.zip" />
        </label>
        <button type="button" class="neu-btn neu-btn--sm" id="add-cloud-link-btn">
          ${icon('cloud', { size: 15 })} Vincular Enlace (Drive / OneDrive)
        </button>
      </div>

      <!-- Cloud Link Form (Hidden by default) -->
      <div id="cloud-link-form" style="display:none;margin-bottom:var(--space-md);padding:var(--space-sm);background:var(--bg-card);border-radius:var(--radius-xs);border:1px solid var(--border-subtle)">
        <div style="display:flex;gap:var(--space-xs);align-items:center">
          <input type="text" id="cloud-doc-title" class="neu-input" placeholder="Nombre (ej: Temario Completo Drive)" style="flex:1" />
          <input type="url" id="cloud-doc-url" class="neu-input" placeholder="https://drive.google.com/..." style="flex:1.5" />
          <button type="button" class="neu-btn neu-btn--sm neu-btn--primary" id="save-cloud-link-btn">Guardar</button>
        </div>
      </div>

      <!-- Files List -->
      <div style="font-size:0.8rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">
        Documentos & Temario de esta asignatura
      </div>
      <div class="file-list" id="subject-files-container">
        ${renderFilesListHtml()}
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  // Close
  document.getElementById('files-modal-close').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  const rebindFileActions = () => {
    const listEl = document.getElementById('subject-files-container');
    if (!listEl) return;
    listEl.innerHTML = renderFilesListHtml();

    // Download / view file
    listEl.querySelectorAll('[data-download-file]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fileObj = agendaFiles.find(f => f.id === btn.dataset.downloadFile);
        if (fileObj) {
          try {
            await downloadLocalFile(fileObj);
          } catch (e) {
            showToast('No se pudo descargar el archivo local', 'error');
          }
        }
      });
    });

    // Delete file
    listEl.querySelectorAll('[data-delete-file]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fId = btn.dataset.deleteFile;
        await removeLocalFile(fId);
        agendaFiles = agendaFiles.filter(f => f.id !== fId);
        persistAgendaLocal();
        showToast('Documento eliminado', 'info');
        rebindFileActions();
      });
    });
  };

  rebindFileActions();

  // Local file uploader (stores in browser IndexedDB without server dependency)
  document.getElementById('local-file-uploader')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const f of files) {
      const fileRecord = {
        id: 'file_' + Math.random().toString(36).substring(2, 9),
        subject_id: subject.id,
        name: f.name,
        title: f.name,
        storage_type: 'local',
        file_size: f.size,
        created_at: new Date().toISOString(),
      };
      await storeLocalFile(fileRecord, f);
      agendaFiles.push(fileRecord);
    }

    persistAgendaLocal();
    showToast(`¡${files.length} archivo(s) guardado(s) localmente! 📁`, 'success');
    rebindFileActions();
  });

  // Pick User Local Directory from PC (File System Access API)
  document.getElementById('pick-local-dir-btn')?.addEventListener('click', async () => {
    const res = await pickUserLocalDirectory();
    if (res && res.directoryName) {
      subject.local_folder_name = res.directoryName;
      subject.storage_type = 'local';
      // If files were detected in the directory, import references
      if (res.files && res.files.length > 0) {
        for (const f of res.files) {
          if (!agendaFiles.some(existing => existing.subject_id === subject.id && existing.title === f.name)) {
            agendaFiles.push({
              id: 'file_' + Math.random().toString(36).substring(2, 9),
              subject_id: subject.id,
              name: f.name,
              title: f.name,
              storage_type: 'local',
              file_size: f.size,
              created_at: new Date().toISOString(),
            });
          }
        }
      }
      persistAgendaLocal();
      showToast(`Carpeta "${res.directoryName}" vinculada con éxito 💻`, 'success');
      backdrop.remove();
      renderPage();
    } else if (res && !res.supported) {
      showToast('Tu navegador no soporta el explorador de carpetas nativo. Usa la subida de archivos.', 'info');
    }
  });

  // Toggle cloud link form
  const cloudForm = document.getElementById('cloud-link-form');
  document.getElementById('add-cloud-link-btn')?.addEventListener('click', () => {
    cloudForm.style.display = cloudForm.style.display === 'none' ? 'block' : 'none';
  });

  // Save cloud link
  document.getElementById('save-cloud-link-btn')?.addEventListener('click', () => {
    const title = document.getElementById('cloud-doc-title').value.trim();
    const url = document.getElementById('cloud-doc-url').value.trim();
    if (!title || !url) {
      showToast('Completa el título y la URL del documento', 'error');
      return;
    }

    const isDrive = url.includes('drive.google.com');
    const isOneDrive = url.includes('onedrive') || url.includes('sharepoint');

    agendaFiles.push({
      id: 'file_' + Math.random().toString(36).substring(2, 9),
      subject_id: subject.id,
      name: title,
      title: title,
      storage_type: isDrive ? 'gdrive' : isOneDrive ? 'onedrive' : 'url',
      file_size: 0,
      url: url,
      created_at: new Date().toISOString(),
    });

    persistAgendaLocal();
    showToast('Enlace de temario añadido ☁️', 'success');
    cloudForm.style.display = 'none';
    rebindFileActions();
  });
}

// ─── NOTES PAGE ───
function renderNotesPage(container) {
  const categories = ['Todas', 'Ideas', 'Tareas', 'Reflexiones', 'Estrategia'];

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md)">
        <div>
          <h1 class="page-header__title">
            ${icon('book', { size: 28 })} Notas & Diario Estoico
          </h1>
          <p class="page-header__subtitle">Captura tus reflexiones, lecciones y tareas pendientes</p>
        </div>
        <button class="neu-btn neu-btn--primary" id="add-note-btn">
          ${icon('plus', { size: 18 })} Nueva Nota
        </button>
      </div>

      <!-- Filter Chips -->
      <div class="chip-group" style="margin-bottom: var(--space-lg)">
        ${categories
          .map(
            (c, i) =>
              `<span class="chip ${i === 0 ? 'chip--active' : ''}" data-category="${c}">${c}</span>`
          )
          .join('')}
      </div>

      <!-- Notes List -->
      <div class="notes-list" id="notes-list">
        ${notes.length === 0
          ? `<div class="neu-card empty-state">
              <div class="empty-state__icon">${icon('book', { size: 36 })}</div>
              <div class="empty-state__text">Sin notas aún</div>
              <div class="empty-state__hint">Registra planes de entrenamiento, reflexiones o metas</div>
            </div>`
          : notes
              .map(
                (n) => `
                <div class="note-item neu-card" data-note-category="${n.category || 'Todas'}">
                  <div class="note-item__color" style="background: ${n.color || 'var(--accent-primary)'}"></div>
                  <div class="note-item__content">
                    <div class="note-item__title">${n.title}</div>
                    <div class="note-item__text">${(n.content || '').replace(/\n/g, '<br>')}</div>
                    <div class="note-item__meta">
                      <span class="neu-badge neu-badge--info">${n.category || 'Sin categoría'}</span>
                      <span>${formatDateTime(n.updated_at)}</span>
                    </div>
                  </div>
                  <div class="note-item__actions">
                    <button class="neu-btn neu-btn--icon-sm" data-edit-note="${n.id}" title="Editar">
                      ${icon('edit', { size: 15 })}
                    </button>
                    <button class="neu-btn neu-btn--icon-sm" data-delete-note="${n.id}" title="Eliminar">
                      ${icon('trash', { size: 15 })}
                    </button>
                  </div>
                </div>`
              )
              .join('')}
      </div>
    </div>
  `;

  // Category filter
  container.querySelectorAll('[data-category]').forEach((chip) => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-category]').forEach((c) => c.classList.remove('chip--active'));
      chip.classList.add('chip--active');
      const cat = chip.dataset.category;
      container.querySelectorAll('[data-note-category]').forEach((note) => {
        note.style.display =
          cat === 'Todas' || note.dataset.noteCategory === cat ? '' : 'none';
      });
    });
  });

  // Add note
  document.getElementById('add-note-btn').addEventListener('click', () => showNoteModal());

  // Edit
  container.querySelectorAll('[data-edit-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const n = notes.find((note) => note.id === btn.dataset.editNote);
      if (n) showNoteModal(n);
    });
  });

  // Delete
  container.querySelectorAll('[data-delete-note]').forEach((btn) => {
    btn.addEventListener('click', () => deleteNote(btn.dataset.deleteNote));
  });
}

function showNoteModal(editNote = null) {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const noteColors = ['#e2e8f0', '#94a3b8', '#64748b', '#10b981', '#eab308', '#ef4444'];
  const categories = ['Ideas', 'Tareas', 'Reflexiones', 'Estrategia'];

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-content">
      <h2 style="font-size:1.25rem;font-weight:800;margin-bottom:var(--space-lg);display:flex;align-items:center;gap:8px">
        ${icon('book', { size: 22 })} ${editNote ? 'Editar Nota' : 'Nueva Nota / Reflexión'}
      </h2>
      <form id="note-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="note-title">Título</label>
          <input type="text" id="note-title" class="neu-input" placeholder="Título o idea principal" required value="${editNote?.title || ''}" />
        </div>
        <div class="neu-input-wrapper">
          <label for="note-content">Contenido</label>
          <textarea id="note-content" class="neu-textarea" placeholder="Escribe aquí tus pensamientos o plan de acción...">${editNote?.content || ''}</textarea>
        </div>
        <div class="neu-input-wrapper">
          <label for="note-category">Categoría</label>
          <select id="note-category" class="neu-input" style="cursor:pointer">
            ${categories
              .map(
                (c) => `<option value="${c}" ${editNote?.category === c ? 'selected' : ''}>${c}</option>`
              )
              .join('')}
          </select>
        </div>
        <div class="neu-input-wrapper">
          <label>Color de Resalte</label>
          <div class="note-colors">
            ${noteColors
              .map(
                (c) =>
                  `<div class="note-color-dot ${editNote?.color === c ? 'note-color-dot--active' : ''}" style="background:${c}" data-color="${c}"></div>`
              )
              .join('')}
          </div>
        </div>
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button type="button" class="neu-btn" id="note-cancel">Cancelar</button>
          <button type="submit" class="neu-btn neu-btn--primary">${editNote ? 'Guardar' : 'Crear Nota'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  let selectedColor = editNote?.color || '#e2e8f0';

  backdrop.querySelectorAll('[data-color]').forEach((el) => {
    el.addEventListener('click', () => {
      backdrop.querySelectorAll('[data-color]').forEach((e) => e.classList.remove('note-color-dot--active'));
      el.classList.add('note-color-dot--active');
      selectedColor = el.dataset.color;
    });
  });

  document.getElementById('note-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  document.getElementById('note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('note-title').value.trim();
    const content = document.getElementById('note-content').value.trim();
    const category = document.getElementById('note-category').value;

    if (!title) return;

    if (editNote) {
      const { data } = await supabase
        .from('notes')
        .update({ title, content, category, color: selectedColor, updated_at: new Date().toISOString() })
        .eq('id', editNote.id)
        .select()
        .single();
      if (data) {
        const idx = notes.findIndex((n) => n.id === data.id);
        if (idx >= 0) notes[idx] = data;
        showToast('Nota actualizada', 'success');
      }
    } else {
      const { data } = await supabase
        .from('notes')
        .insert({
          user_id: currentUser.id,
          title,
          content,
          category,
          color: selectedColor,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (data) {
        notes.unshift(data);
        showToast('Nota creada con éxito', 'success');
      }
    }

    backdrop.remove();
    renderPage();
  });
}

async function deleteNote(id) {
  if (!confirm('¿Eliminar esta nota?')) return;
  await supabase.from('notes').delete().eq('id', id);
  notes = notes.filter((n) => n.id !== id);
  showToast('Nota eliminada', 'info');
  renderPage();
}

// ─── POMODORO PAGE ───
function renderPomodoroPage(container) {
  const minutes = Math.floor(pomodoroSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (pomodoroSeconds % 60).toString().padStart(2, '0');

  const focusMin = Math.round(POMODORO_DURATIONS.focus / 60);
  const shortMin = Math.round(POMODORO_DURATIONS.short / 60);
  const longMin = Math.round(POMODORO_DURATIONS.long / 60);

  const modeLabels = { focus: 'Deep Work (Enfoque)', short: 'Descanso Breve', long: 'Descanso Largo' };

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="text-align:center">
        <h1 class="page-header__title" style="justify-content:center">
          ${icon('timer', { size: 30 })} Deep Work Timer
        </h1>
        <p class="page-header__subtitle">Bloques de enfoque implacable para el Winter Arc</p>
      </div>

      <div class="neu-card pomodoro" style="max-width:540px;margin:0 auto">
        <div class="pomodoro__tabs">
          <span class="pomodoro__tab ${pomodoroMode === 'focus' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="focus">
            ${icon('zap', { size: 14 })} ${focusMin}m Enfoque
          </span>
          <span class="pomodoro__tab ${pomodoroMode === 'short' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="short">
            ${shortMin}m Corto
          </span>
          <span class="pomodoro__tab ${pomodoroMode === 'long' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="long">
            ${longMin}m Largo
          </span>
        </div>

        <div class="pomodoro__label">${modeLabels[pomodoroMode]}</div>
        <div class="pomodoro__display" id="pomo-display">${minutes}:${seconds}</div>

        <div class="pomodoro__controls">
          <button class="neu-btn neu-btn--icon" id="pomo-reset" title="Reiniciar">
            ${icon('rotate', { size: 18 })}
          </button>
          <button class="neu-btn ${pomodoroRunning ? 'neu-btn--danger' : 'neu-btn--primary'} neu-btn--lg" id="pomo-toggle">
            ${pomodoroRunning ? icon('pause', { size: 18 }) + ' Pausar' : icon('play', { size: 18 }) + ' Iniciar Sesión'}
          </button>
          <button class="neu-btn neu-btn--icon" id="pomo-skip" title="Saltar">
            ${icon('skip', { size: 18 })}
          </button>
        </div>

        <div class="pomodoro__sessions">
          ${Array.from({ length: 4 }, (_, i) =>
            `<div class="pomodoro__session-dot ${i < pomodoroSessions ? 'pomodoro__session-dot--done' : ''}"></div>`
          ).join('')}
        </div>
      </div>

      <!-- Configuración personalizada de Deep Work -->
      <div class="pomodoro-settings" style="max-width:540px;margin:var(--space-xl) auto 0">
        <div class="pomodoro-settings__title">
          ${icon('edit', { size: 18 })} Personalizar Tiempos de Deep Work
        </div>
        <div class="pomodoro-settings__grid">
          <div class="pomodoro-settings__field">
            <label for="cfg-focus">Enfoque (min)</label>
            <input type="number" id="cfg-focus" class="pomodoro-settings__input" min="1" max="180" value="${focusMin}" />
          </div>
          <div class="pomodoro-settings__field">
            <label for="cfg-short">Descanso (min)</label>
            <input type="number" id="cfg-short" class="pomodoro-settings__input" min="1" max="60" value="${shortMin}" />
          </div>
          <div class="pomodoro-settings__field">
            <label for="cfg-long">Largo (min)</label>
            <input type="number" id="cfg-long" class="pomodoro-settings__input" min="1" max="90" value="${longMin}" />
          </div>
        </div>
        <div class="pomodoro-presets-row">
          <span style="font-size:0.75rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-right:6px">Plantillas:</span>
          <span class="chip" id="pomo-pre-classic">25 / 5 min (Clásico)</span>
          <span class="chip" id="pomo-pre-deep">50 / 10 min (Deep Work)</span>
          <span class="chip" id="pomo-pre-ultra">90 / 20 min (Ultradiano)</span>
        </div>
      </div>

      <div style="text-align:center;margin-top:var(--space-xl);color:var(--text-secondary);font-size:0.88rem;max-width:500px;margin-left:auto;margin-right:auto">
        <p>💡 <strong>Filosofía:</strong> Ajusta los bloques a tu capacidad de concentración. Durante el bloque de Deep Work, silencia distracciones y fluye.</p>
      </div>
    </div>
  `;

  // Tab switch
  container.querySelectorAll('[data-pomo-mode]').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (pomodoroRunning) return;
      pomodoroMode = tab.dataset.pomoMode;
      pomodoroSeconds = POMODORO_DURATIONS[pomodoroMode];
      renderPomodoroPage(container);
    });
  });

  // Settings update helpers
  const updateCustomDurations = (newFocus, newShort, newLong) => {
    if (newFocus && newFocus > 0) {
      POMODORO_DURATIONS.focus = newFocus * 60;
      localStorage.setItem('pomo_focus', newFocus);
    }
    if (newShort && newShort > 0) {
      POMODORO_DURATIONS.short = newShort * 60;
      localStorage.setItem('pomo_short', newShort);
    }
    if (newLong && newLong > 0) {
      POMODORO_DURATIONS.long = newLong * 60;
      localStorage.setItem('pomo_long', newLong);
    }
    if (!pomodoroRunning) {
      pomodoroSeconds = POMODORO_DURATIONS[pomodoroMode];
    }
    renderPomodoroPage(container);
    showToast('Tiempos de Deep Work actualizados ⚡', 'info');
  };

  document.getElementById('cfg-focus')?.addEventListener('change', (e) => {
    updateCustomDurations(parseInt(e.target.value), null, null);
  });
  document.getElementById('cfg-short')?.addEventListener('change', (e) => {
    updateCustomDurations(null, parseInt(e.target.value), null);
  });
  document.getElementById('cfg-long')?.addEventListener('change', (e) => {
    updateCustomDurations(null, null, parseInt(e.target.value));
  });

  document.getElementById('pomo-pre-classic')?.addEventListener('click', () => {
    updateCustomDurations(25, 5, 15);
  });
  document.getElementById('pomo-pre-deep')?.addEventListener('click', () => {
    updateCustomDurations(50, 10, 20);
  });
  document.getElementById('pomo-pre-ultra')?.addEventListener('click', () => {
    updateCustomDurations(90, 20, 30);
  });

  // Toggle
  document.getElementById('pomo-toggle').addEventListener('click', () => {
    if (pomodoroRunning) {
      clearInterval(pomodoroTimer);
      pomodoroRunning = false;
    } else {
      pomodoroRunning = true;
      pomodoroTimer = setInterval(() => {
        pomodoroSeconds--;
        if (pomodoroSeconds <= 0) {
          clearInterval(pomodoroTimer);
          pomodoroRunning = false;
          playBeepChime();

          if (pomodoroMode === 'focus') {
            pomodoroSessions++;
            showToast('¡Sesión de Deep Work completada! ❄️', 'success');

            if (pomodoroSessions % 4 === 0) {
              pomodoroMode = 'long';
              pomodoroSeconds = POMODORO_DURATIONS.long;
            } else {
              pomodoroMode = 'short';
              pomodoroSeconds = POMODORO_DURATIONS.short;
            }
          } else {
            showToast('¡Descanso terminado! Volvamos al foco 💪', 'info');
            pomodoroMode = 'focus';
            pomodoroSeconds = POMODORO_DURATIONS.focus;
          }
          renderPomodoroPage(container);
          return;
        }

        const display = document.getElementById('pomo-display');
        if (display) {
          const m = Math.floor(pomodoroSeconds / 60).toString().padStart(2, '0');
          const s = (pomodoroSeconds % 60).toString().padStart(2, '0');
          display.textContent = `${m}:${s}`;
        }
      }, 1000);
    }
    renderPomodoroPage(container);
  });

  // Reset
  document.getElementById('pomo-reset').addEventListener('click', () => {
    clearInterval(pomodoroTimer);
    pomodoroRunning = false;
    pomodoroSeconds = POMODORO_DURATIONS[pomodoroMode];
    renderPomodoroPage(container);
  });

  // Skip
  document.getElementById('pomo-skip').addEventListener('click', () => {
    clearInterval(pomodoroTimer);
    pomodoroRunning = false;

    if (pomodoroMode === 'focus') {
      pomodoroSessions++;
      pomodoroMode = pomodoroSessions % 4 === 0 ? 'long' : 'short';
    } else {
      pomodoroMode = 'focus';
    }
    pomodoroSeconds = POMODORO_DURATIONS[pomodoroMode];
    renderPomodoroPage(container);
  });
}

// ─── MOOD & MENTALITY PAGE ───
function renderMoodPage(container) {
  const todayMood = moods.find((m) => m.date === todayStr());
  const moodOptions = [
    { key: 'great', iconName: 'shield', label: 'Imparable', color: 'var(--accent-mood-great)' },
    { key: 'good', iconName: 'zap', label: 'Enfocado', color: 'var(--accent-mood-good)' },
    { key: 'neutral', iconName: 'brain', label: 'Estable', color: 'var(--accent-mood-neutral)' },
    { key: 'bad', iconName: 'frown', label: 'Fatigado', color: 'var(--accent-mood-bad)' },
    { key: 'awful', iconName: 'flame', label: 'Prueba Dura', color: 'var(--accent-mood-awful)' },
  ];

  const moodColorMap = {
    great: '#10b981',
    good: '#34d399',
    neutral: '#fbbf24',
    bad: '#fda4af',
    awful: '#f87171',
  };

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="text-align:center">
        <h1 class="page-header__title" style="justify-content:center">
          ${icon('brain', { size: 30 })} Estado Mental & Resiliencia
        </h1>
        <p class="page-header__subtitle">Registra tu temple psicológico para dominar el invierno</p>
      </div>

      <div class="neu-card" style="max-width:540px;margin:0 auto var(--space-lg)">
        <div class="neu-card__header">
          <h2 class="neu-card__title">
            ${icon('target', { size: 20 })} ¿Cómo está tu mentalidad hoy?
          </h2>
          ${todayMood ? '<span class="neu-badge neu-badge--success">Registrado ✓</span>' : ''}
        </div>
        <div class="mood-selector">
          ${moodOptions
            .map(
              (m) => `
              <div class="mood-btn ${todayMood?.mood === m.key ? 'mood-btn--active' : ''}"
                   data-mood="${m.key}" title="${m.label}"
                   style="${todayMood?.mood === m.key ? `background:${m.color};border-color:transparent` : ''}">
                ${icon(m.iconName, { size: 22, color: todayMood?.mood === m.key ? '#ffffff' : 'currentColor' })}
              </div>`
            )
            .join('')}
        </div>

        <div style="margin-top: var(--space-md)">
          <textarea id="mood-note" class="neu-textarea" placeholder="Reflexión estoica del día o qué desafío superaste...">${todayMood?.note || ''}</textarea>
        </div>
      </div>

      <!-- History -->
      <div class="neu-card" style="max-width:720px;margin:0 auto">
        <div class="neu-card__header">
          <h2 class="neu-card__title">
            ${icon('calendar', { size: 20 })} Registro de Temple (últimos 30 días)
          </h2>
        </div>
        ${moods.length === 0
          ? `<div class="empty-state">
              <div class="empty-state__icon">${icon('brain', { size: 36 })}</div>
              <div class="empty-state__text">Sin registros de mentalidad</div>
            </div>`
          : `
          <div class="mood-history">
            ${moods
              .slice()
              .reverse()
              .map(
                (m) => `
                <div class="mood-history__item" title="${formatDate(m.date)}: ${m.mood}${m.note ? ' — ' + m.note : ''}">
                  <div class="mood-history__dot" style="background:${moodColorMap[m.mood] || '#38bdf8'}">
                    ${icon('shield', { size: 10, color: '#ffffff' })}
                  </div>
                  <span class="mood-history__date">${formatDate(m.date)}</span>
                </div>`
              )
              .join('')}
          </div>`}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-mood]').forEach((btn) => {
    btn.addEventListener('click', () => saveMood(btn.dataset.mood));
  });
}

async function saveMood(moodValue) {
  const today = todayStr();
  const note = document.getElementById('mood-note')?.value?.trim() || '';
  const existing = moods.find((m) => m.date === today);

  if (existing) {
    const { data } = await supabase
      .from('moods')
      .update({ mood: moodValue, note })
      .eq('id', existing.id)
      .select()
      .single();
    if (data) {
      const idx = moods.findIndex((m) => m.id === data.id);
      if (idx >= 0) moods[idx] = data;
    }
  } else {
    const { data } = await supabase
      .from('moods')
      .insert({ user_id: currentUser.id, mood: moodValue, date: today, note })
      .select()
      .single();
    if (data) moods.unshift(data);
  }

  showToast('Estado mental registrado ❄️', 'success');
  renderPage();
}

// ─── App Initialization ───
async function init() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      currentUser = session.user;
      renderAppShell();
    } else {
      renderAuth();
    }
  } catch (err) {
    console.error('Error fetching session:', err);
    renderAuth();
  }

  try {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        currentUser = session.user;
        renderAppShell();
      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        habits = [];
        habitLogs = [];
        notes = [];
        moods = [];
        clearInterval(pomodoroTimer);
        pomodoroRunning = false;
        renderAuth();
      }
    });
  } catch (e) {
    console.error('Error setting auth listener:', e);
  }
}

init();

