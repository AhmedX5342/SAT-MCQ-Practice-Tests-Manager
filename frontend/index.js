// Page transitions: fade-in on load, fade-out on internal navigation
document.body.classList.add('transition-opacity', 'duration-200', 'opacity-0');
window.addEventListener('DOMContentLoaded', () => {
  // fade in
  requestAnimationFrame(() => document.body.classList.remove('opacity-0'));
  // intercept internal links for a smooth fade-out
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


// === Load saved tests and render the table ===
async function loadTests() {
  try {
    const res = await fetch('/api/tests');
    if (!res.ok) throw new Error(`Failed to load tests: ${res.status}`);
    const tests = await res.json();

    const tbody = document.querySelector("#testsTable tbody");
    if (!tbody) return; // nothing to render into

    // clear previous rows (keep the table header intact)
    tbody.innerHTML = "";

    if (!Array.isArray(tests) || tests.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="p-2" colspan="4">No tests saved yet.</td>`;
      tbody.appendChild(tr);
      return;
    }

    tests.forEach(test => {
      // fallback values in case fields are missing
      const name = test.name ?? "Untitled";
      const total = test.numQuestions ?? test.total ?? (Array.isArray(test.answers) ? test.answers.length : 0);
      // score should be (total - wrong) / total
      const wrong = Array.isArray(test.answers) ? test.answers.filter(a => a.markedWrong).length : 0;
      const answered = Array.isArray(test.answers) ? test.answers.filter(a => a.choice || a.answer).length : 0;
      const correct = typeof total === 'number' && total > 0 ? (total - wrong) : 0;
      const dateText = test.date ? new Date(test.date).toLocaleString() : "";

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="p-2 border">${escapeHtml(name)}</td>
        <td class="p-2 border">${escapeHtml(String(correct))}/${escapeHtml(String(total))}</td>
        <td class="p-2 border">${escapeHtml(dateText)}</td>
        <td class="p-2 border space-x-2">
          <button class="viewDetails bg-blue-500 text-white px-3 py-1 rounded" data-id="${test.id}">View Details</button>
          <button class="deleteTest bg-red-500 text-white px-3 py-1 rounded" data-id="${test.id}">Delete</button>
        </td>`;
      tbody.appendChild(row);
    });

    // attach handlers
    tbody.querySelectorAll('.viewDetails').forEach(btn => btn.addEventListener('click', () => openDetails(btn.dataset.id)));
    tbody.querySelectorAll('.deleteTest').forEach(btn => btn.addEventListener('click', () => deleteTest(btn.dataset.id)));

  } catch (err) {
    console.error(err);
    // optionally display an error row
    const tbody = document.querySelector("#testsTable tbody");
    if (tbody) {
      tbody.innerHTML = `<tr><td class="p-2" colspan="4">Error loading tests.</td></tr>`;
    }
  }
}

// small utility to avoid XSS when inserting text into innerHTML templates
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

loadTests();


// === View Details modal ===
async function openDetails(id) {
  try {
    const res = await fetch(`/api/tests/${id}`);
    if (!res.ok) throw new Error('Failed to fetch test');
    const test = await res.json();
    const modal = document.getElementById("modal");
    const answersBox = document.getElementById("modalBody");
    const modalTitle = document.getElementById("modalTitle");
    const saveBtn = document.getElementById('saveDetails');

    if (!modal || !answersBox) return;

    if (modalTitle) modalTitle.textContent = `Details — ${test.name ?? 'Untitled'}`;

    answersBox.innerHTML = "";

    const answers = Array.isArray(test.answers) ? test.answers : [];
    const perColumn = 10;

    // Render function: when showWrong=true we render editable view (with Wrong checkboxes).
    // when showWrong=false we render a read-only "answers only" layout (no checkboxes),
    // with 10 questions per column.
    function renderColumns(showWrong) {
      answersBox.innerHTML = '';

      const cols = Math.max(1, Math.ceil(answers.length / perColumn));

      // For editable mode keep previous layout (horizontal scrollable columns).
      if (showWrong) {
        const container = document.createElement('div');
        container.className = 'overflow-x-auto w-full';

        const wrapper = document.createElement('div');
        wrapper.className = 'flex gap-6';

        for (let c = 0; c < cols; c++) {
          const colDiv = document.createElement('div');
          colDiv.className = 'flex flex-col gap-2';

          const start = c * perColumn;
          const end = Math.min(start + perColumn, answers.length);

          for (let i = start; i < end; i++) {
            const ans = answers[i] ?? {};
            const choice = ans.choice ?? ans.answer ?? '-';
              const row = document.createElement('div');
              row.className = 'flex items-center justify-between p-2 border rounded bg-gray-50 dark:bg-gray-700';
              const checked = ans.markedWrong ? 'checked' : '';
              // include a compact correct answer input and a wrong-toggle box that shows X when active
              const correctVal = ans.correctAnswer ? escapeHtml(ans.correctAnswer) : '';
              row.innerHTML = `
                <div class="flex items-center gap-3">
                  <div class="text-sm">Q${i + 1}: <strong>${escapeHtml(choice)}</strong></div>
                  <input type="text" data-index="${i}" class="correctAnswerInput ml-2 w-12 h-6 text-center text-sm border rounded hidden" placeholder="" value="${correctVal}" />
                </div>
                <div class="flex items-center gap-2">
                  <button type="button" class="wrongToggle w-8 h-8 flex items-center justify-center border rounded text-red-600" data-index="${i}" aria-pressed="false" title="Mark wrong"></button>
                </div>
              `;

            colDiv.appendChild(row);
          }

          colDiv.style.minWidth = '220px';
          wrapper.appendChild(colDiv);
        }

        container.appendChild(wrapper);
        answersBox.appendChild(container);

        // wire up wrongToggle buttons to toggle markedWrong and show the small correct-answer input
        answersBox.querySelectorAll('.wrongToggle').forEach(btn => {
          const idx = Number(btn.dataset.index);
          // initialize appearance from data
          const existing = Array.isArray(test.answers) && test.answers[idx] && test.answers[idx].markedWrong;
          if (existing) {
            btn.classList.add('bg-red-600', 'text-white', 'border-red-600');
            btn.setAttribute('aria-pressed', 'true');
            btn.textContent = '✖';
            const inputInit = answersBox.querySelector(`.correctAnswerInput[data-index='${idx}']`);
            if (inputInit) inputInit.classList.remove('hidden');
          } else {
            btn.textContent = '';
          }

          btn.addEventListener('click', (ev) => {
            const iidx = Number(ev.currentTarget.dataset.index);
            if (!Array.isArray(test.answers)) test.answers = [];
            if (!test.answers[iidx]) test.answers[iidx] = {};
            const now = !test.answers[iidx].markedWrong;
            test.answers[iidx].markedWrong = now;
            // toggle button style
            if (now) {
              ev.currentTarget.classList.add('bg-red-600', 'text-white', 'border-red-600');
              ev.currentTarget.setAttribute('aria-pressed', 'true');
              ev.currentTarget.textContent = '✖';
            } else {
              ev.currentTarget.classList.remove('bg-red-600', 'text-white', 'border-red-600');
              ev.currentTarget.setAttribute('aria-pressed', 'false');
              ev.currentTarget.textContent = '';
            }
            // show/hide corresponding correct answer input and auto-focus when showing
            const input = answersBox.querySelector(`.correctAnswerInput[data-index='${iidx}']`);
            if (input) {
              if (now) {
                input.classList.remove('hidden');
                input.focus();
              } else {
                input.classList.add('hidden');
              }
            }
          });
        });

        // wire up correct answer input changes (small square inputs) with trimming
        answersBox.querySelectorAll('.correctAnswerInput').forEach(inp => {
          inp.addEventListener('input', (ev) => {
            const idx = Number(ev.target.dataset.index);
            if (!Array.isArray(test.answers)) test.answers = [];
            if (!test.answers[idx]) test.answers[idx] = {};
            test.answers[idx].correctAnswer = ev.target.value.trim();
          });
        });

        if (saveBtn) saveBtn.style.display = '';
        return;
      }

      // Answers-only mode: create a compact grid so many columns can fit without scrolling.
      // We'll compute an available width inside the modal and size columns accordingly.
      const modalContentEl = modal.querySelector(':scope > div') || modal.firstElementChild;
      const availableWidth = (modalContentEl && modalContentEl.clientWidth) ? modalContentEl.clientWidth - 48 : Math.min(window.innerWidth - 80, 1200);
      // target at most 10 columns visible comfortably; ensure each column is at least 60px
      const targetColumns = Math.min(10, Math.max(1, cols));
      const colWidth = Math.max(60, Math.floor(availableWidth / targetColumns) - 8);

      const container = document.createElement('div');
      container.className = 'w-full';
      // use CSS grid with columns equal to the number of columns needed; each column gets the calculated width.
      container.style.display = 'grid';
      container.style.gridAutoFlow = 'column';
      container.style.gridAutoColumns = `${colWidth}px`;
      container.style.gridTemplateRows = `repeat(${perColumn}, auto)`;
      container.style.gap = '6px';
      container.style.overflow = 'hidden';

      // populate grid cells; we place each answer into the next available cell (flowing by column)
      for (let idx = 0; idx < answers.length; idx++) {
        const ans = answers[idx] ?? {};
        const choice = ans.choice ?? ans.answer ?? '-';

        const cell = document.createElement('div');
        cell.className = 'p-1 text-sm rounded bg-gray-50 dark:bg-gray-700 border';
        cell.style.minHeight = '28px';
        cell.style.display = 'flex';
        cell.style.alignItems = 'center';
        cell.style.justifyContent = 'flex-start';
        cell.style.paddingLeft = '6px';
        cell.innerHTML = `Q${idx + 1}: <strong>${escapeHtml(choice)}</strong>`;

        // compute row/column placement: column = Math.floor(idx / perColumn), row = (idx % perColumn) + 1
        const col = Math.floor(idx / perColumn) + 1;
        const row = (idx % perColumn) + 1;
        cell.style.gridColumn = String(col);
        cell.style.gridRow = String(row);

        container.appendChild(cell);
      }

      answersBox.appendChild(container);

      // hide save button in answers-only mode
      if (saveBtn) saveBtn.style.display = 'none';
    }

    // initial render: editable view (with Wrong checkboxes)
    renderColumns(true);

    // Save changes button will persist the updated answers array
    if (saveBtn) {
      saveBtn.onclick = async () => {
        try {
          await saveTestAnswers(test.id, test.answers);
          modal.classList.add('hidden');
          modal.classList.remove('flex');
          await loadTests();
        } catch (e) {
          console.error(e);
        }
      };
    }

    // add handler for the new 'View Answers Only' and 'Back to editable' buttons if present
    const viewAnswersOnlyBtn = document.getElementById('viewAnswersOnly');
    const backToEditableBtn = document.getElementById('backToEditable');
    if (viewAnswersOnlyBtn) {
      viewAnswersOnlyBtn.onclick = () => {
        renderColumns(false);
        viewAnswersOnlyBtn.classList.add('hidden');
        if (backToEditableBtn) backToEditableBtn.classList.remove('hidden');
      };
    }
    if (backToEditableBtn) {
      backToEditableBtn.onclick = () => {
        renderColumns(true);
        backToEditableBtn.classList.add('hidden');
        if (viewAnswersOnlyBtn) viewAnswersOnlyBtn.classList.remove('hidden');
      };
    }

    // show modal with animation (overlay fade + content scale)
    const modalContent = modal.querySelector(':scope > div') || modal.firstElementChild;
    function animateOpen() {
      modal.classList.remove('hidden');
      modal.classList.add('flex', 'items-center');
      // start hidden/shifted
      modal.classList.add('opacity-0');
      modalContent.classList.add('translate-y-4', 'scale-95', 'opacity-0');

      requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('transition', 'duration-200', 'opacity-100');
        modalContent.classList.remove('translate-y-4', 'scale-95');
        modalContent.classList.add('transition', 'duration-200', 'translate-y-0', 'scale-100', 'opacity-100');
      });
    }

    function animateClose() {
      modal.classList.add('opacity-0');
      modalContent.classList.add('translate-y-4', 'scale-95', 'opacity-0');
      setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex', 'opacity-0', 'opacity-100', 'transition', 'duration-200');
        modalContent.classList.remove('translate-y-4', 'scale-95', 'opacity-0', 'translate-y-0', 'scale-100', 'opacity-100', 'transition', 'duration-200');
      }, 200);
    }

    animateOpen();

    // close by close button
    const closeBtn = document.getElementById("closeModal");
    if (closeBtn) closeBtn.onclick = () => animateClose();

    // close by clicking outside the modal content
    modal.onclick = (ev) => {
      if (ev.target === modal) animateClose();
    };

  } catch (err) {
    console.error(err);
    alert("Could not open test details.");
  }
}


// === Save answers via PUT ===
async function saveTestAnswers(id, answersArray) {
  try {
    const payload = { answers: answersArray };
    const res = await fetch(`/api/tests/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Save failed');
    return await res.json();
  } catch (err) {
    console.error(err);
    alert("Failed to save changes.");
    throw err;
  }
}

// Delete helper used by delete buttons in the table
async function deleteTest(id) {
  if (!confirm('Delete this test?')) return;
  try {
    const res = await fetch(`/api/tests/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 204) throw new Error('Delete failed');
    await loadTests();
  } catch (err) {
    console.error(err);
    alert('Failed to delete test');
  }
}
