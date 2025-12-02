/* Test page behavior: start, navigate, answer choices, save */

(() => {
  // Page fade-in and smooth internal navigation
  document.body.classList.add('transition-opacity', 'duration-200', 'opacity-0');
  window.addEventListener('DOMContentLoaded', () => {
    requestAnimationFrame(() => document.body.classList.remove('opacity-0'));
    document.querySelectorAll('a[href^="/"]').forEach(a => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (!href || href.startsWith('#')) return;
        e.preventDefault();
        document.body.classList.add('opacity-0');
        setTimeout(() => (window.location.href = href), 180);
      });
    });
  });
  const createForm = document.getElementById('createForm');
  const createSection = createForm?.closest('section');
  const startBtn = document.getElementById('startBtn');
  const resetBtn = document.getElementById('resetBtn');
  const testNameInput = document.getElementById('testName');
  const numQuestionsInput = document.getElementById('numQuestions');
  const enableTimer = document.getElementById('enableTimer');
  const timerMinutes = document.getElementById('timerMinutes');
  const timerMinutesLabel = document.getElementById('timerMinutesLabel');
  const timerContainer = document.getElementById('timerContainer');
  const timerDisplay = document.getElementById('timerDisplay');
  const selectedChoiceEl = document.getElementById('selectedChoice');
  const tagGuessedBtn = document.getElementById('tagGuessed');
  const tagStudyBtn = document.getElementById('tagStudy');

  const tester = document.getElementById('tester');
  const gridView = document.getElementById('gridView');
  const displayName = document.getElementById('displayName');
  const currentIndexEl = document.getElementById('currentIndex');
  const totalQEl = document.getElementById('totalQ');
  const progressBar = document.getElementById('progressBar');
  const answeredCountEl = document.getElementById('answeredCount');
  const saveBtn = document.getElementById('saveTest');

  if (!startBtn || !testNameInput || !numQuestionsInput) return;

  let totalQuestions = 0;
  let current = 1;
  let answers = [];
  let timerInterval = null;
  let remainingSeconds = 0;

  function updateUI() {
    if (displayName) displayName.textContent = testNameInput.value || '';
    if (currentIndexEl) currentIndexEl.textContent = String(current);
    if (totalQEl) totalQEl.textContent = String(totalQuestions);
    const answered = answers.filter(a => a && a.choice).length;
    if (answeredCountEl) answeredCountEl.textContent = String(answered);
    const pct = totalQuestions ? Math.round((current - 1) / totalQuestions * 100) : 0;
    if (progressBar) progressBar.style.width = pct + '%';
    // always show selected answer for the current question
    const currentChoice = (answers[current - 1] && answers[current - 1].choice) || '-';
    if (selectedChoiceEl) selectedChoiceEl.textContent = currentChoice;
    // update quick-jump grid state
    updateGrid();
    // update tag buttons appearance to reflect current question
    const currAns = answers[current - 1] || {};
    if (tagGuessedBtn) {
      tagGuessedBtn.classList.toggle('bg-yellow-300', !!currAns.guessed);
      tagGuessedBtn.classList.toggle('font-semibold', !!currAns.guessed);
    }
    if (tagStudyBtn) {
      tagStudyBtn.classList.toggle('bg-red-300', !!currAns.requiresStudy);
      tagStudyBtn.classList.toggle('font-semibold', !!currAns.requiresStudy);
    }
  }

  function showTester() {
    if (tester) tester.classList.remove('hidden');
    // show tag buttons when tester is visible
    if (tagGuessedBtn) tagGuessedBtn.classList.remove('hidden');
    if (tagStudyBtn) tagStudyBtn.classList.remove('hidden');
    updateUI();
  }

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const name = testNameInput.value.trim();
    const n = parseInt(numQuestionsInput.value, 10);
    if (!name) return alert('Please enter a test name');
    if (!n || n <= 0) return alert('Enter a valid number of questions');

    totalQuestions = n;
    answers = new Array(totalQuestions).fill(null);
    current = 1;
    if (displayName) displayName.textContent = name;
    showTester();
    // render quick-jump grid after starting
    renderGrid();
    // hide the settings card so only the tester is visible
    if (createSection) createSection.classList.add('hidden');
    focusChoiceButtons();
    // Timer handling
    if (enableTimer && enableTimer.checked) {
      const mins = parseInt(timerMinutes?.value || '0', 10) || 0;
      remainingSeconds = Math.max(0, mins * 60);
      if (timerContainer) timerContainer.classList.remove('hidden');
      updateTimerDisplay();
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        remainingSeconds -= 1;
        if (remainingSeconds <= 0) {
          clearInterval(timerInterval);
          timerInterval = null;
          remainingSeconds = 0;
          updateTimerDisplay();
          // time's up
          alert('Time is up');
          // disable answering
          document.querySelectorAll('.choiceBtn').forEach(b => b.disabled = true);
        } else {
          updateTimerDisplay();
        }
      }, 1000);
    } else {
      if (timerContainer) timerContainer.classList.add('hidden');
    }
    // ensure selected display is visible
    document.getElementById('selectedDisplay').classList.remove('hidden');
  });

  resetBtn?.addEventListener('click', () => {
    createForm?.reset();
    if (tester) tester.classList.add('hidden');
    totalQuestions = 0; current = 1; answers = [];
    // clear quick-jump grid
    if (gridView) gridView.innerHTML = '';
    // show settings card again
    if (createSection) createSection.classList.remove('hidden');
    // clear timer if running
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    if (timerContainer) timerContainer.classList.add('hidden');
    if (selectedChoiceEl) selectedChoiceEl.textContent = '-';
  });

  function focusChoiceButtons() {
    const first = document.querySelector('.choiceBtn');
    if (first) first.focus();
  }

  function setAnswer(choice) {
    if (!totalQuestions) return;
    const prev = answers[current - 1] || {};
    answers[current - 1] = { ...prev, choice };
    // auto-advance
    if (current < totalQuestions) {
      current++;
    }
    updateUI();
  }

  // tag toggles
  function toggleTag(tagName) {
    if (!totalQuestions) return;
    const idx = current - 1;
    const prev = answers[idx] || {};
    const next = { ...prev };
    if (tagName === 'guessed') next.guessed = !next.guessed;
    if (tagName === 'requiresStudy') next.requiresStudy = !next.requiresStudy;
    answers[idx] = next;
    updateUI();
  }

  if (tagGuessedBtn) tagGuessedBtn.addEventListener('click', () => toggleTag('guessed'));
  if (tagStudyBtn) tagStudyBtn.addEventListener('click', () => toggleTag('requiresStudy'));

  // choice buttons
  document.querySelectorAll('.choiceBtn').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const c = btn.dataset.choice;
      setAnswer(c);
    });
  });

  // prev/next
  document.getElementById('prevBtn')?.addEventListener('click', () => {
    if (current > 1) current--;
    updateUI();
  });
  document.getElementById('nextBtn')?.addEventListener('click', () => {
    if (current < totalQuestions) current++;
    updateUI();
  });

  // keyboard shortcuts A-E
  window.addEventListener('keydown', (e) => {
    if (!totalQuestions) return;
    const key = e.key.toLowerCase();
    if (['a','b','c','d','e'].includes(key)) {
      setAnswer(key.toUpperCase());
    }
  });

  // keyboard shortcuts 1-5 (map to A-E)
  window.addEventListener('keydown', (e) => {
    if (!totalQuestions) return;
    const key = e.key;
    const choiceMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
    if (choiceMap[key]) {
      setAnswer(choiceMap[key]);
    }
  });

  // timer display helper
  function updateTimerDisplay() {
    if (!timerDisplay) return;
    const mm = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
    const ss = String(remainingSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${mm}:${ss}`;
  }

  // --- Quick-jump grid helpers ---
  function renderGrid() {
    if (!gridView) return;
    gridView.innerHTML = '';
    for (let i = 0; i < totalQuestions; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'qbox relative p-2 rounded border text-sm bg-white hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 flex items-center justify-center';
      btn.dataset.num = String(i + 1);
      // number and possible badges will be set in updateGrid
      btn.innerHTML = `<span class="qnum">${String(i + 1)}</span>`;
      btn.dataset.index = String(i + 1);
      btn.addEventListener('click', () => {
        current = i + 1;
        updateUI();
        focusChoiceButtons();
      });
      gridView.appendChild(btn);
    }
    updateGrid();
  }

  function updateGrid() {
    if (!gridView) return;
    const boxes = Array.from(gridView.querySelectorAll('.qbox'));
    boxes.forEach((b, idx) => {
      const ans = answers[idx] || {};
      const answered = !!ans.choice;
      b.classList.toggle('bg-green-200', answered);
      b.classList.toggle('dark:bg-green-700', answered);
      b.classList.toggle('bg-white', !answered);

      // build inner content: number + optional badges
      const num = idx + 1;
      let inner = `<span class="qnum">${num}</span>`;
      if (ans.guessed) {
        inner += `<span class="ml-1 text-[10px] px-1 rounded bg-yellow-300 text-yellow-900">G</span>`;
      }
      if (ans.requiresStudy) {
        inner += `<span class="ml-1 text-[10px] px-1 rounded bg-red-300 text-red-900">S</span>`;
      }
      b.innerHTML = inner;

      if (idx + 1 === current) {
        b.classList.add('ring-2', 'ring-indigo-500');
      } else {
        b.classList.remove('ring-2', 'ring-indigo-500');
      }
    });
  }

  // show/hide minutes input when enableTimer toggles
  if (enableTimer && timerMinutesLabel) {
    enableTimer.addEventListener('change', () => {
      if (enableTimer.checked) timerMinutesLabel.classList.remove('hidden');
      else timerMinutesLabel.classList.add('hidden');
    });
    // initialize
    if (!enableTimer.checked) timerMinutesLabel.classList.add('hidden');
  }

  // selected answer is always displayed; no toggle necessary

  // save
  saveBtn?.addEventListener('click', async () => {
    const name = testNameInput.value.trim();
    if (!name) return alert('Missing test name');
    try {
      const payload = {
        name,
        numQuestions: totalQuestions,
        answers: answers.map(a => ({
          choice: a?.choice ?? null,
          guessed: !!a?.guessed,
          requiresStudy: !!a?.requiresStudy
        }))
      };
      const res = await fetch('/api/tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Save failed');
      // after saving go home
      window.location.href = '/';
    } catch (err) {
      console.error(err);
      alert('Failed to save test');
    }
  });

})();