// ═══════════════════════════════════════════════════════════
// MyDiscipline — Winter Arc Application
// Full Neumorphic Productivity Engine with Dark/Light Themes
// ═══════════════════════════════════════════════════════════

import './style.css';
import { supabase } from './supabaseClient.js';
import { showToast } from './toast.js';
import { getDailyQuote } from './quotes.js';
import { icon, ICONS, WINTER_ARC_PRESETS } from './icons.js';

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
const POMODORO_DURATIONS = { focus: 25 * 60, short: 5 * 60, long: 15 * 60 };

// Mood state
let moods = [];

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
            <span class="sidebar__link-icon">${icon('snowflake', { size: 19 })}</span> Hábitos Arc
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
  await Promise.all([loadHabits(), loadHabitLogs(), loadNotes(), loadMoods()]);
  renderPage();
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
  const completedToday = todayLogs.length;
  const totalHabits = habits.length;
  const todayPercent = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

  const longestStreak = calculateLongestStreak();
  const currentStreak = calculateCurrentStreak();
  const quote = getDailyQuote();
  const todayMood = moods.find((m) => m.date === todayStr());

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
          ${habits.length === 0
            ? `<div class="empty-state">
                <div class="empty-state__icon">${icon('snowflake', { size: 30 })}</div>
                <div class="empty-state__text">Aún no has configurado tus hábitos</div>
                <div class="empty-state__hint">Añade rutinas del Winter Arc para forjar disciplina</div>
              </div>`
            : habits
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
      </div>
    </div>
  `;

  document.getElementById('header-theme-btn').addEventListener('click', toggleTheme);

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
            ${icon('snowflake', { size: 28 })} Hábitos del Winter Arc
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
          <label for="habit-freq">Frecuencia</label>
          <select id="habit-freq" class="neu-input" style="cursor:pointer">
            <option value="Diario" ${editHabit?.frequency === 'Diario' ? 'selected' : ''}>Diario (Winter Arc)</option>
            <option value="L-V" ${editHabit?.frequency === 'L-V' ? 'selected' : ''}>Lunes a Viernes</option>
            <option value="3x/semana" ${editHabit?.frequency === '3x/semana' ? 'selected' : ''}>3 veces/semana</option>
            <option value="Semanal" ${editHabit?.frequency === 'Semanal' ? 'selected' : ''}>Semanal</option>
          </select>
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

  backdrop.querySelectorAll('[data-icon]').forEach((el) => {
    el.addEventListener('click', () => {
      backdrop.querySelectorAll('[data-icon]').forEach((e) => e.classList.remove('chip--active'));
      el.classList.add('chip--active');
      selectedIcon = el.dataset.icon;
    });
  });

  document.getElementById('habit-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });

  document.getElementById('habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('habit-name').value.trim();
    const frequency = document.getElementById('habit-freq').value;

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
            ${icon('zap', { size: 14 })} 25m Enfoque
          </span>
          <span class="pomodoro__tab ${pomodoroMode === 'short' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="short">
            5m Corto
          </span>
          <span class="pomodoro__tab ${pomodoroMode === 'long' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="long">
            15m Largo
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

      <div style="text-align:center;margin-top:var(--space-xl);color:var(--text-secondary);font-size:0.88rem;max-width:500px;margin-left:auto;margin-right:auto">
        <p>💡 <strong>Filosofía:</strong> Durante el bloque de 25 min silencia notificaciones, pon música binaural y entra en estado de flujo total.</p>
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

