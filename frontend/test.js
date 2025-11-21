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

  const tester = document.getElementById('tester');
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
  }

  function showTester() {
    if (tester) tester.classList.remove('hidden');
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
    answers[current - 1] = { choice };
    // auto-advance
    if (current < totalQuestions) {
      current++;
    }
    updateUI();
  }

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
        answers: answers.map(a => ({ choice: a?.choice ?? null }))
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