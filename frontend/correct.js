/* Correction page behavior */

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

  const testSelect = document.getElementById('testSelect');
  const answerKeyImage = document.getElementById('answerKeyImage');
  const imagePreview = document.getElementById('imagePreview');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const correctionForm = document.getElementById('correctionForm');
  const statusContainer = document.getElementById('statusContainer');
  const statusMessage = document.getElementById('statusMessage');
  const submitBtn = document.getElementById('submitBtn');

  // Load tests on page load
  async function loadTestsDropdown() {
    try {
      const res = await fetch('/api/tests');
      if (!res.ok) throw new Error('Failed to load tests');
      const tests = await res.json();

      testSelect.innerHTML = '<option value="">-- Choose a test --</option>';
      tests.forEach(test => {
        const option = document.createElement('option');
        option.value = test.id;
        option.textContent = test.name;
        testSelect.appendChild(option);
      });
    } catch (err) {
      console.error(err);
      showStatus('Error loading tests', 'error');
    }
  }

  // Image preview
  answerKeyImage.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        imagePreview.src = event.target.result;
        imagePreviewContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle paste event to support pasting images from clipboard
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            imagePreview.src = event.target.result;
            imagePreviewContainer.classList.remove('hidden');
            // Create a synthetic File object and set it to the input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            answerKeyImage.files = dataTransfer.files;
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  });

  // Form submission
  correctionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const testId = testSelect.value;
    const imageFile = answerKeyImage.files[0];

    if (!testId) {
      showStatus('Please select a test', 'error');
      return;
    }
    if (!imageFile) {
      showStatus('Please upload an answer key image', 'error');
      return;
    }

    submitBtn.disabled = true;
    showStatus('Processing answer key and correcting test...', 'info');

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        let imageBase64 = event.target.result.split(',')[1]; // remove data:image/...;base64, prefix

        // Send to backend for correction
        const res = await fetch('/api/correct-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testId,
            answerKeyImage: imageBase64
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Correction failed');
        }

        const result = await res.json();
        showStatus(`Test corrected successfully! Score: ${result.correct}/${result.total}`, 'success');
        correctionForm.reset();
        imagePreviewContainer.classList.add('hidden');
        
        // Redirect to home after 2 seconds
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
      };
      reader.readAsDataURL(imageFile);
    } catch (err) {
      console.error(err);
      showStatus(`Error: ${err.message}`, 'error');
      submitBtn.disabled = false;
    }
  });

  // Status message helper
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusContainer.classList.remove('hidden', 'bg-green-50', 'border-green-200', 'text-green-800', 'bg-red-50', 'border-red-200', 'text-red-800', 'bg-blue-50', 'border-blue-200', 'text-blue-800');
    
    if (type === 'success') {
      statusContainer.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
    } else if (type === 'error') {
      statusContainer.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
    } else if (type === 'info') {
      statusContainer.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-800');
    }
  }

  // Initialize
  loadTestsDropdown();
})();
