// ═══════════════════════════════════════════════════════════
// MyDiscipline — Main Application
// ═══════════════════════════════════════════════════════════

import './style.css';
import { supabase } from './supabaseClient.js';
import { showToast } from './toast.js';
import { getDailyQuote } from './quotes.js';

// ─── State ───
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

// ─── Auth ───
function renderAuth() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-wrapper">
      <div class="auth-card neu-raised-lg slide-up">
        <div class="auth-card__logo">
          <div class="auth-card__logo-icon">🎯</div>
          <h1 class="auth-card__title">MyDiscipline</h1>
          <p class="auth-card__subtitle">Tu sistema de disciplina y rendimiento personal</p>
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
        showToast('¡Bienvenido de vuelta! 💪', 'success');
      } else {
        showToast('¡Cuenta creada! Revisa tu correo para confirmar.', 'success', 5000);
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

  app.innerHTML = `
    <button class="mobile-toggle neu-btn neu-btn--icon" id="mobile-toggle" aria-label="Abrir menú">☰</button>
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar__brand">
          <div class="sidebar__brand-icon">🎯</div>
          <span class="sidebar__brand-text">MyDiscipline</span>
        </div>
        <nav class="sidebar__nav">
          <div class="sidebar__link sidebar__link--active" data-page="dashboard">
            <span class="sidebar__link-icon">📊</span> Dashboard
          </div>
          <div class="sidebar__link" data-page="habits">
            <span class="sidebar__link-icon">✅</span> Hábitos
          </div>
          <div class="sidebar__link" data-page="notes">
            <span class="sidebar__link-icon">📝</span> Notas
          </div>
          <div class="sidebar__link" data-page="pomodoro">
            <span class="sidebar__link-icon">🍅</span> Pomodoro
          </div>
          <div class="sidebar__link" data-page="mood">
            <span class="sidebar__link-icon">😊</span> Estado de Ánimo
          </div>
        </nav>
        <div class="sidebar__user">
          <div class="sidebar__avatar">${initials}</div>
          <div class="sidebar__user-info">
            <div class="sidebar__user-name">${userEmail.split('@')[0]}</div>
            <div class="sidebar__user-email">${userEmail}</div>
          </div>
          <button class="neu-btn neu-btn--icon-sm" id="logout-btn" aria-label="Cerrar sesión" title="Cerrar sesión">⏻</button>
        </div>
      </aside>
      <main class="main-content" id="main-content">
        <!-- Page content rendered here -->
      </main>
    </div>
  `;

  // Nav
  document.querySelectorAll('.sidebar__link').forEach((link) => {
    link.addEventListener('click', () => {
      currentPage = link.dataset.page;
      document.querySelectorAll('.sidebar__link').forEach((l) => l.classList.remove('sidebar__link--active'));
      link.classList.add('sidebar__link--active');
      renderPage();
      closeSidebar();
    });
  });

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

  // Close sidebar on main content click (mobile)
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

  // Calculate streaks
  const longestStreak = calculateLongestStreak();
  const currentStreak = calculateCurrentStreak();

  // Quote of the day
  const quote = getDailyQuote();

  // Today's mood
  const todayMood = moods.find((m) => m.date === todayStr());
  const moodEmojis = { great: '😄', good: '🙂', neutral: '😐', bad: '😟', awful: '😢' };

  const weekDays = getWeekDays();
  const today = new Date();

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header">
        <h1 class="page-header__title">¡Buenos días, ${currentUser.email.split('@')[0]}! 👋</h1>
        <p class="page-header__subtitle">${today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      <!-- Quote -->
      <div class="neu-card quote-card" style="margin-bottom: var(--space-lg)">
        <p class="quote-card__text">"${quote.text}"</p>
        <p class="quote-card__author">— ${quote.author}</p>
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
          <div class="stat-card__icon">🎯</div>
          <div class="stat-card__value">${todayPercent}%</div>
          <div class="stat-card__label">Progreso Hoy</div>
        </div>
        <div class="stat-card neu-raised-sm">
          <div class="stat-card__icon">🔥</div>
          <div class="stat-card__value">${currentStreak}</div>
          <div class="stat-card__label">Racha Actual</div>
        </div>
        <div class="stat-card neu-raised-sm">
          <div class="stat-card__icon">🏆</div>
          <div class="stat-card__value">${longestStreak}</div>
          <div class="stat-card__label">Mejor Racha</div>
        </div>
        <div class="stat-card neu-raised-sm">
          <div class="stat-card__icon">${todayMood ? moodEmojis[todayMood.mood] || '😊' : '❓'}</div>
          <div class="stat-card__value">${todayMood ? todayMood.mood.charAt(0).toUpperCase() + todayMood.mood.slice(1) : '—'}</div>
          <div class="stat-card__label">Ánimo Hoy</div>
        </div>
      </div>

      <!-- Dashboard Grid -->
      <div class="dashboard-grid">
        <!-- Today's Habits -->
        <div class="neu-card">
          <div class="neu-card__header">
            <h2 class="neu-card__title">✅ Hábitos de Hoy</h2>
            <span class="neu-badge ${todayPercent === 100 ? 'neu-badge--success' : todayPercent >= 50 ? 'neu-badge--warning' : 'neu-badge--danger'}">${completedToday}/${totalHabits}</span>
          </div>
          <div class="neu-progress" style="margin-bottom: var(--space-md)">
            <div class="neu-progress__fill ${todayPercent === 100 ? 'neu-progress__fill--success' : ''}" style="width: ${todayPercent}%"></div>
          </div>
          ${habits.length === 0
            ? '<div class="empty-state"><div class="empty-state__icon">🌱</div><div class="empty-state__text">Crea tu primer hábito</div></div>'
            : habits
                .slice(0, 5)
                .map((h) => {
                  const done = todayLogs.some((l) => l.habit_id === h.id);
                  return `
                  <div class="habit-item neu-raised-sm" style="margin-bottom: var(--space-sm)">
                    <div class="habit-item__check ${done ? 'habit-item__check--done' : ''}" data-habit-id="${h.id}" data-dash-toggle>
                      ${done ? '✓' : ''}
                    </div>
                    <div class="habit-item__info">
                      <div class="habit-item__name">${h.icon || '📌'} ${h.name}</div>
                    </div>
                  </div>`;
                })
                .join('')}
        </div>

        <!-- Recent Notes -->
        <div class="neu-card">
          <div class="neu-card__header">
            <h2 class="neu-card__title">📝 Notas Recientes</h2>
          </div>
          ${notes.length === 0
            ? '<div class="empty-state"><div class="empty-state__icon">📋</div><div class="empty-state__text">Sin notas aún</div></div>'
            : notes
                .slice(0, 4)
                .map(
                  (n) => `
                <div class="note-item neu-raised-sm" style="margin-bottom: var(--space-sm)">
                  <div class="note-item__color" style="background: ${n.color || '#6c63ff'}"></div>
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

  // Dashboard habit toggle
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
          <h1 class="page-header__title">Mis Hábitos</h1>
          <p class="page-header__subtitle">Construye la mejor versión de ti mismo</p>
        </div>
        <button class="neu-btn neu-btn--primary" id="add-habit-btn">+ Nuevo Hábito</button>
      </div>

      <!-- Heatmap -->
      <div class="neu-card" style="margin-bottom: var(--space-lg)">
        <div class="neu-card__header">
          <h2 class="neu-card__title">🗓️ Actividad (últimos 90 días)</h2>
        </div>
        <div class="heatmap" id="heatmap">
          ${renderHeatmap(last90)}
        </div>
      </div>

      <!-- Habit List -->
      <div class="habits-grid" id="habits-list">
        ${habits.length === 0
          ? `<div class="neu-card empty-state">
              <div class="empty-state__icon">🌱</div>
              <div class="empty-state__text">Aún no tienes hábitos</div>
              <div class="empty-state__hint">Pulsa "+ Nuevo Hábito" para empezar tu transformación</div>
            </div>`
          : habits
              .map((h) => {
                const done = todayLogs.some((l) => l.habit_id === h.id);
                const streak = getHabitStreak(h.id);
                return `
                <div class="habit-item neu-card" style="padding: var(--space-md) var(--space-lg)">
                  <div class="habit-item__check ${done ? 'habit-item__check--done' : ''}" data-habit-id="${h.id}">
                    ${done ? '✓' : ''}
                  </div>
                  <div class="habit-item__info">
                    <div class="habit-item__name">${h.icon || '📌'} ${h.name}</div>
                    <div class="habit-item__streak">🔥 Racha: ${streak} días</div>
                  </div>
                  <span class="habit-item__frequency neu-badge neu-badge--info">${h.frequency || 'Diario'}</span>
                  <div class="habit-item__actions">
                    <button class="neu-btn neu-btn--icon-sm" data-edit-habit="${h.id}" title="Editar">✏️</button>
                    <button class="neu-btn neu-btn--icon-sm" data-delete-habit="${h.id}" title="Eliminar">🗑️</button>
                  </div>
                </div>`;
              })
              .join('')}
      </div>
    </div>
  `;

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
  // Group by week
  const weeks = [];
  let currentWeek = [];

  days.forEach((day, i) => {
    const d = new Date(day);
    const dow = d.getDay();

    if (i === 0 && dow !== 1) {
      // Pad first week
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

  const icons = ['🏃', '📖', '💧', '🧘', '💪', '🎯', '📝', '🌅', '🥗', '😴', '🧠', '🎵', '💻', '🌿', '⏰'];

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-content">
      <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:var(--space-lg)">${editHabit ? 'Editar Hábito' : 'Nuevo Hábito'}</h2>
      <form id="habit-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="habit-name">Nombre del Hábito</label>
          <input type="text" id="habit-name" class="neu-input" placeholder="Ej: Leer 20 minutos" required value="${editHabit?.name || ''}" />
        </div>
        <div class="neu-input-wrapper">
          <label>Icono</label>
          <div class="chip-group" id="icon-selector">
            ${icons
              .map(
                (icon) =>
                  `<span class="chip ${editHabit?.icon === icon ? 'chip--active' : ''}" data-icon="${icon}">${icon}</span>`
              )
              .join('')}
          </div>
        </div>
        <div class="neu-input-wrapper">
          <label for="habit-freq">Frecuencia</label>
          <select id="habit-freq" class="neu-input" style="cursor:pointer">
            <option value="Diario" ${editHabit?.frequency === 'Diario' ? 'selected' : ''}>Diario</option>
            <option value="L-V" ${editHabit?.frequency === 'L-V' ? 'selected' : ''}>Lunes a Viernes</option>
            <option value="3x/semana" ${editHabit?.frequency === '3x/semana' ? 'selected' : ''}>3 veces/semana</option>
            <option value="Semanal" ${editHabit?.frequency === 'Semanal' ? 'selected' : ''}>Semanal</option>
          </select>
        </div>
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;margin-top:var(--space-md)">
          <button type="button" class="neu-btn" id="habit-cancel">Cancelar</button>
          <button type="submit" class="neu-btn neu-btn--primary">${editHabit ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  let selectedIcon = editHabit?.icon || '📌';

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

    if (editHabit) {
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
        showToast('¡Nuevo hábito creado! 🎉', 'success');
      }
    }

    backdrop.remove();
    renderPage();
  });
}

async function deleteHabit(id) {
  if (!confirm('¿Eliminar este hábito y todo su historial?')) return;

  await supabase.from('habit_logs').delete().eq('habit_id', id);
  await supabase.from('habits').delete().eq('id', id);
  habits = habits.filter((h) => h.id !== id);
  habitLogs = habitLogs.filter((l) => l.habit_id !== id);
  showToast('Hábito eliminado', 'info');
  renderPage();
}

// ─── NOTES PAGE ───
function renderNotesPage(container) {
  const noteColors = ['#6c63ff', '#2ed573', '#ffa502', '#ff4757', '#1e90ff', '#a29bfe'];
  const categories = ['Todas', 'Ideas', 'Tareas', 'Reflexiones'];

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-md)">
        <div>
          <h1 class="page-header__title">Notas & Ideas</h1>
          <p class="page-header__subtitle">Captura tus pensamientos y tareas pendientes</p>
        </div>
        <button class="neu-btn neu-btn--primary" id="add-note-btn">+ Nueva Nota</button>
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
              <div class="empty-state__icon">💡</div>
              <div class="empty-state__text">Sin notas aún</div>
              <div class="empty-state__hint">Captura ideas, listas de tareas o reflexiones</div>
            </div>`
          : notes
              .map(
                (n) => `
                <div class="note-item neu-card" data-note-category="${n.category || 'Todas'}">
                  <div class="note-item__color" style="background: ${n.color || '#6c63ff'}"></div>
                  <div class="note-item__content">
                    <div class="note-item__title">${n.title}</div>
                    <div class="note-item__text">${(n.content || '').replace(/\n/g, '<br>')}</div>
                    <div class="note-item__meta">
                      <span class="neu-badge neu-badge--info">${n.category || 'Sin categoría'}</span>
                      <span>${formatDateTime(n.updated_at)}</span>
                    </div>
                  </div>
                  <div class="note-item__actions">
                    <button class="neu-btn neu-btn--icon-sm" data-edit-note="${n.id}" title="Editar">✏️</button>
                    <button class="neu-btn neu-btn--icon-sm" data-delete-note="${n.id}" title="Eliminar">🗑️</button>
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

  const noteColors = ['#6c63ff', '#2ed573', '#ffa502', '#ff4757', '#1e90ff', '#a29bfe'];
  const categories = ['Ideas', 'Tareas', 'Reflexiones'];

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-content">
      <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:var(--space-lg)">${editNote ? 'Editar Nota' : 'Nueva Nota'}</h2>
      <form id="note-form" style="display:flex;flex-direction:column;gap:var(--space-md)">
        <div class="neu-input-wrapper">
          <label for="note-title">Título</label>
          <input type="text" id="note-title" class="neu-input" placeholder="Título de la nota" required value="${editNote?.title || ''}" />
        </div>
        <div class="neu-input-wrapper">
          <label for="note-content">Contenido</label>
          <textarea id="note-content" class="neu-textarea" placeholder="Escribe aquí tus ideas...">${editNote?.content || ''}</textarea>
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
          <label>Color</label>
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
          <button type="submit" class="neu-btn neu-btn--primary">${editNote ? 'Guardar' : 'Crear'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);

  let selectedColor = editNote?.color || '#6c63ff';

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
        showToast('Nota creada ✏️', 'success');
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

  const modeLabels = { focus: 'Enfoque', short: 'Descanso Corto', long: 'Descanso Largo' };

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="text-align:center">
        <h1 class="page-header__title">🍅 Pomodoro Timer</h1>
        <p class="page-header__subtitle">Concéntrate y sé productivo</p>
      </div>

      <div class="neu-card pomodoro" style="max-width:500px;margin:0 auto">
        <div class="pomodoro__tabs">
          <span class="pomodoro__tab ${pomodoroMode === 'focus' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="focus">Enfoque</span>
          <span class="pomodoro__tab ${pomodoroMode === 'short' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="short">Corto</span>
          <span class="pomodoro__tab ${pomodoroMode === 'long' ? 'pomodoro__tab--active' : ''}" data-pomo-mode="long">Largo</span>
        </div>

        <div class="pomodoro__label">${modeLabels[pomodoroMode]}</div>
        <div class="pomodoro__display" id="pomo-display">${minutes}:${seconds}</div>

        <div class="pomodoro__controls">
          <button class="neu-btn neu-btn--icon" id="pomo-reset" title="Reiniciar">↺</button>
          <button class="neu-btn ${pomodoroRunning ? 'neu-btn--danger' : 'neu-btn--primary'} neu-btn--lg" id="pomo-toggle">
            ${pomodoroRunning ? '⏸ Pausar' : '▶ Iniciar'}
          </button>
          <button class="neu-btn neu-btn--icon" id="pomo-skip" title="Saltar">⏭</button>
        </div>

        <div class="pomodoro__sessions">
          ${Array.from({ length: 4 }, (_, i) =>
            `<div class="pomodoro__session-dot ${i < pomodoroSessions ? 'pomodoro__session-dot--done' : ''}"></div>`
          ).join('')}
        </div>
      </div>

      <div style="text-align:center;margin-top:var(--space-xl);color:var(--text-secondary);font-size:0.85rem">
        <p>💡 Técnica: 25min de enfoque → 5min descanso → Cada 4 sesiones, 15min de descanso largo</p>
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
            showToast('¡Sesión completada! Hora de descansar 🎉', 'success');

            // Auto-switch to break
            if (pomodoroSessions % 4 === 0) {
              pomodoroMode = 'long';
              pomodoroSeconds = POMODORO_DURATIONS.long;
            } else {
              pomodoroMode = 'short';
              pomodoroSeconds = POMODORO_DURATIONS.short;
            }
          } else {
            showToast('¡Descanso terminado! Vamos a por otra sesión 💪', 'info');
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

// ─── MOOD PAGE ───
function renderMoodPage(container) {
  const todayMood = moods.find((m) => m.date === todayStr());
  const moodOptions = [
    { key: 'great', emoji: '😄', label: 'Genial', color: 'var(--accent-mood-great)' },
    { key: 'good', emoji: '🙂', label: 'Bien', color: 'var(--accent-mood-good)' },
    { key: 'neutral', emoji: '😐', label: 'Normal', color: 'var(--accent-mood-neutral)' },
    { key: 'bad', emoji: '😟', label: 'Mal', color: 'var(--accent-mood-bad)' },
    { key: 'awful', emoji: '😢', label: 'Fatal', color: 'var(--accent-mood-awful)' },
  ];

  const moodColorMap = {
    great: '#2ed573',
    good: '#7bed9f',
    neutral: '#ffa502',
    bad: '#ff6b81',
    awful: '#ff4757',
  };

  container.innerHTML = `
    <div class="tab-content">
      <div class="page-header" style="text-align:center">
        <h1 class="page-header__title">Estado de Ánimo</h1>
        <p class="page-header__subtitle">Registra cómo te sientes cada día para identificar patrones</p>
      </div>

      <div class="neu-card" style="max-width:500px;margin:0 auto var(--space-lg)">
        <div class="neu-card__header">
          <h2 class="neu-card__title">¿Cómo te sientes hoy?</h2>
          ${todayMood ? '<span class="neu-badge neu-badge--success">Registrado ✓</span>' : ''}
        </div>
        <div class="mood-selector">
          ${moodOptions
            .map(
              (m) => `
              <div class="mood-btn ${todayMood?.mood === m.key ? 'mood-btn--active' : ''}"
                   data-mood="${m.key}" title="${m.label}"
                   style="${todayMood?.mood === m.key ? `background:${m.color};color:white` : ''}">
                ${m.emoji}
              </div>`
            )
            .join('')}
        </div>

        <!-- Optional note for today -->
        <div style="margin-top: var(--space-md)">
          <textarea id="mood-note" class="neu-textarea" placeholder="¿Quieres añadir una nota sobre cómo te sientes?" style="min-height:70px">${todayMood?.note || ''}</textarea>
        </div>
      </div>

      <!-- Mood History -->
      <div class="neu-card" style="max-width:700px;margin:0 auto">
        <div class="neu-card__header">
          <h2 class="neu-card__title">📅 Historial (últimos 30 días)</h2>
        </div>
        ${moods.length === 0
          ? '<div class="empty-state"><div class="empty-state__icon">📊</div><div class="empty-state__text">Sin registros aún</div></div>'
          : `
          <div class="mood-history">
            ${moods
              .slice()
              .reverse()
              .map(
                (m) => `
                <div class="mood-history__item" title="${formatDate(m.date)}: ${m.mood}${m.note ? ' — ' + m.note : ''}">
                  <div class="mood-history__dot" style="background:${moodColorMap[m.mood] || '#ccc'}"></div>
                  <span class="mood-history__date">${formatDate(m.date)}</span>
                </div>`
              )
              .join('')}
          </div>`}
      </div>
    </div>
  `;

  // Mood selection
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

  showToast('Ánimo registrado 💙', 'success');
  renderPage();
}

// ─── Initialize ───
async function init() {
  // Check for existing session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.user) {
    currentUser = session.user;
    renderAppShell();
  } else {
    renderAuth();
  }

  // Listen for auth changes
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
}

init();
