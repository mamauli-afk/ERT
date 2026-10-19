/* ============================================================
   Электронная рабочая тетрадь по Red Expert
   app.js — сохранение ответов, восстановление, прогресс, экспорт
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'red_expert_workbook_v1';
  const IMG_PREFIX  = 'img:';
  const MAX_IMG_BYTES = 250 * 1024; // 250 КБ на один скриншот

  /* ------------------------------------------------------------
     Манифест всех заданий тетради.
     Используется для подсчёта общего прогресса на главной странице.
     ⚠ При изменении количества заданий в модулях — обновите этот объект.
     ------------------------------------------------------------ */
  const MODULES = {
    m1: { title: 'Модуль 1. Введение в Red Expert',       tasks: ['m1_t1', 'm1_t2', 'm1_t3'] },
    m2: { title: 'Модуль 2. Подключение к БД',             tasks: ['m2_t1', 'm2_t2', 'm2_t3'] },
    m3: { title: 'Модуль 3. Интерфейс и навигация',        tasks: ['m3_t1', 'm3_t2', 'm3_t3'] },
    m4: { title: 'Модуль 4. Редактор SQL-запросов',        tasks: ['m4_t1', 'm4_t2', 'm4_t3', 'm4_t4'] },
    m5: { title: 'Модуль 5. Объекты БД',                   tasks: ['m5_t1', 'm5_t2', 'm5_t3', 'm5_t4', 'm5_t5'] },
    m6: { title: 'Модуль 6. ER-диаграммы',                 tasks: ['m6_t1', 'm6_t2', 'm6_t3'] },
    m7: { title: 'Модуль 7. Пользователи и трассировка',   tasks: ['m7_t1', 'm7_t2', 'm7_t3'] },
    m8: { title: 'Модуль 8. Импорт и экспорт',             tasks: ['m8_t1', 'm8_t2', 'm8_t3'] },
    m9: { title: 'Модуль 9. Итоговый проект',              tasks: ['m9_t1'] }
  };

  const ALL_TASKS = Object.values(MODULES).flatMap(m => m.tasks);

  /* ------------------------------------------------------------
     1. Хранилище (localStorage)
     ------------------------------------------------------------ */
  function readStore() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function writeStore(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Не удалось сохранить данные в localStorage:', e);
      return false;
    }
  }

  function setValue(key, value) {
    const store = readStore();
    store[key] = value;
    return writeStore(store);
  }

  function getValue(key) {
    return readStore()[key];
  }

  /* ------------------------------------------------------------
     2. Сохранение отдельных полей
     ------------------------------------------------------------ */
  function saveField(el) {
    const key = el.dataset.save;
    if (!key) return;
    setValue(key, el.value);
  }

  function saveProgress(el) {
    const key = el.dataset.progress;
    if (!key) return;
    setValue(key, el.checked);
  }

  /* Дебаунс для текстовых полей — чтобы не писать в localStorage
     на каждый символ. Задержка 250 мс. */
  const debouncedTimers = new Map();
  function debouncedSaveField(el) {
    const key = el.dataset.save;
    if (!key) return;
    clearTimeout(debouncedTimers.get(key));
    debouncedTimers.set(key, setTimeout(() => saveField(el), 250));
  }

  /* ------------------------------------------------------------
     3. Восстановление значений при загрузке страницы
     ------------------------------------------------------------ */
  function restoreAll() {
    // текстовые поля и textarea
    document.querySelectorAll('[data-save]').forEach(el => {
      const val = getValue(el.dataset.save);
      if (val !== undefined) el.value = val;
    });

    // чекбоксы «Задание выполнено»
    document.querySelectorAll('[data-progress]').forEach(el => {
      const val = getValue(el.dataset.progress);
      if (val !== undefined) el.checked = !!val;
    });

    // сохранённые скриншоты
    document.querySelectorAll('input[data-preview]').forEach(input => {
      const key = input.dataset.preview;
      const dataUrl = getValue(IMG_PREFIX + key);
      const box = document.getElementById('preview-' + key);
      if (dataUrl && box) {
        box.innerHTML = '<img src="' + dataUrl + '" alt="Скриншот">';
      }
    });
  }

  /* ------------------------------------------------------------
     4. Предпросмотр и сохранение изображений
     ------------------------------------------------------------ */
  function handleImage(input) {
    const key = input.dataset.preview;
    const file = input.files && input.files[0];
    const box = document.getElementById('preview-' + key);
    if (!file || !box) return;

    if (file.size > MAX_IMG_BYTES) {
      alert(
        'Файл больше ' + Math.round(MAX_IMG_BYTES / 1024) + ' КБ. ' +
        'Пожалуйста, сожмите скриншот, чтобы он поместился в тетрадь.'
      );
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target.result;
      box.innerHTML = '<img src="' + dataUrl + '" alt="Скриншот">';
      const ok = setValue(IMG_PREFIX + key, dataUrl);
      if (!ok) {
        // превышена квота — чистим все ранее сохранённые изображения
        cleanImages();
        setValue(IMG_PREFIX + key, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  }

  function cleanImages() {
    const store = readStore();
    Object.keys(store).forEach(k => {
      if (k.startsWith(IMG_PREFIX)) delete store[k];
    });
    writeStore(store);
    alert(
      'Хранилище заполнено. Ранее сохранённые скриншоты удалены — ' +
      'пожалуйста, прикрепите их заново.'
    );
  }

  /* ------------------------------------------------------------
     5. Прогресс
     ------------------------------------------------------------ */
  function getCompletedCount() {
    const store = readStore();
    return ALL_TASKS.filter(k => store[k] === true).length;
  }

  function getModuleCompleted(moduleId) {
    const store = readStore();
    const m = MODULES[moduleId];
    if (!m) return 0;
    return m.tasks.filter(k => store[k] === true).length;
  }

  function updateGlobalProgress() {
    const box = document.querySelector('[data-global-progress]');
    if (!box) return;
    const total = ALL_TASKS.length;
    const done = getCompletedCount();
    const percent = total ? Math.round((done / total) * 100) : 0;

    const spans = box.querySelectorAll('.progress-label span');
    if (spans.length >= 2) {
      spans[0].textContent = 'Выполнено';
      spans[1].textContent = done + ' из ' + total + ' (' + percent + '%)';
    }
    const bar = box.querySelector('.progress-bar');
    if (bar) bar.style.width = percent + '%';
  }

  function updateModuleProgress() {
    document.querySelectorAll('[data-module-progress]').forEach(box => {
      const id = box.dataset.moduleProgress;
      const m = MODULES[id];
      if (!m) return;
      const total = m.tasks.length;
      const done = getModuleCompleted(id);
      const percent = total ? Math.round((done / total) * 100) : 0;

      const spans = box.querySelectorAll('.progress-label span');
      if (spans.length >= 2) {
        spans[1].textContent = done + ' из ' + total + ' (' + percent + '%)';
      }
      const bar = box.querySelector('.progress-bar');
      if (bar) bar.style.width = percent + '%';
    });
  }

  /* ------------------------------------------------------------
     6. Экспорт
     ------------------------------------------------------------ */
  function collectReport() {
    const answers = {};
    const images = {};

    // берём актуальные значения прямо из DOM
    document.querySelectorAll('[data-save]').forEach(el => {
      answers[el.dataset.save] = el.value;
    });
    document.querySelectorAll('[data-progress]').forEach(el => {
      answers[el.dataset.progress] = !!el.checked;
    });

    // отмечаем наличие скриншотов, но сами base64 в JSON не кладём
    const store = readStore();
    Object.keys(store).forEach(k => {
      if (k.startsWith(IMG_PREFIX)) {
        images[k.slice(IMG_PREFIX.length)] = '(скриншот прикреплён в тетради)';
      }
    });

    return {
      generatedAt: new Date().toISOString(),
      answers,
      images
    };
  }

  function exportJSON() {
    const data = collectReport();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'red-expert-workbook-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------
     7. Всплывающее уведомление
     ------------------------------------------------------------ */
  let toastTimer = null;
  function toast(text) {
    let el = document.getElementById('wb-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'wb-toast';
      el.style.cssText = [
        'position:fixed', 'bottom:20px', 'left:50%',
        'transform:translateX(-50%)',
        'padding:0.6rem 1.1rem',
        'background:#1b5e20', 'color:#fff',
        'border-radius:999px', 'font-size:0.9rem',
        'box-shadow:0 6px 20px rgba(15,61,30,0.25)',
        'z-index:9999', 'opacity:0',
        'transition:opacity 0.25s ease',
        'pointer-events:none'
      ].join(';');
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 1600);
  }

  /* ------------------------------------------------------------
     8. Делегирование событий
     ------------------------------------------------------------ */
  function bindEvents() {
    // ввод в textarea/input с data-save
    document.addEventListener('input', e => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (t.matches('[data-save]')) debouncedSaveField(t);
    });

    // изменение чекбоксов и прикрепление файлов
    document.addEventListener('change', e => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;

      if (t.matches('[data-progress]')) {
        saveProgress(t);
        updateGlobalProgress();
        updateModuleProgress();
      }
      if (t.matches('input[type="file"][data-preview]')) {
        handleImage(t);
      }
    });

    // кнопки
    document.addEventListener('click', e => {
      const btn = e.target instanceof HTMLElement ? e.target.closest('button') : null;
      if (!btn) return;

      if (btn.hasAttribute('data-save-all')) {
        document.querySelectorAll('[data-save]').forEach(saveField);
        document.querySelectorAll('[data-progress]').forEach(saveProgress);
        toast('Сохранено');
      }
      if (btn.hasAttribute('data-export')) {
        exportJSON();
        toast('Экспорт JSON');
      }
      if (btn.hasAttribute('data-print')) {
        window.print();
      }
      if (btn.hasAttribute('data-reset')) {
        window.Workbook.reset();
      }
    });
  }

  /* ------------------------------------------------------------
     9. Инициализация
     ------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    restoreAll();
    updateGlobalProgress();
    updateModuleProgress();
    bindEvents();
  });

  /* ------------------------------------------------------------
     10. Публичный API (для ручных вызовов из HTML)
     ------------------------------------------------------------ */
  window.Workbook = {
    exportJSON,
    saveAll() {
      document.querySelectorAll('[data-save]').forEach(saveField);
      document.querySelectorAll('[data-progress]').forEach(saveProgress);
      toast('Сохранено');
    },
    reset() {
      if (!confirm('Удалить все сохранённые ответы и скриншоты?')) return;
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  };
})();