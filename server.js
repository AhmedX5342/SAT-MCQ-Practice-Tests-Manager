const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ocrSpace } = require('ocr-space-api-wrapper');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "tests.json");

// Initialize Gemini AI
const GEMINI_API_KEY = "AIzaSyDYR5rcDoion8teaqlbc238ExDkV1IX_FM";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Helper: list available models from the Generative Language API so we can
// choose a model that supports the method we need (generateContent with images).
async function listAvailableModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) {
      console.warn('ListModels request failed:', r.status);
      return;
    }
    const data = await r.json();
    console.log('Available Gemini models (list):', JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn('Could not list Gemini models:', err.message);
  }
}

// Middleware - regular limits for most routes
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, "frontend")));

// ---------- Utility Functions ----------

// Ensure tests.json exists
async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf8");
  }
}

// Read tests asynchronously
async function readTests() {
  await ensureDataFile();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error reading JSON:", e);
    return [];
  }
}

// Write tests asynchronously
async function writeTests(tests) {
  await fs.writeFile(DATA_FILE, JSON.stringify(tests, null, 2), "utf8");
}

// ---------- API ROUTES ----------

// Get all tests
app.get("/api/tests", async (req, res) => {
  const tests = await readTests();
  res.json(tests);
});

// Get single test by ID
app.get("/api/tests/:id", async (req, res) => {
  const tests = await readTests();
  const test = tests.find(t => t.id === req.params.id);

  if (!test) return res.status(404).json({ error: "Test not found" });

  res.json(test);
});

// Create new test
app.post("/api/tests", express.json({ limit: '10mb' }), async (req, res) => {
  const { name, numQuestions, answers, date } = req.body;

  if (!name || !numQuestions || !Array.isArray(answers)) {
    return res.status(400).json({ error: "Invalid test payload" });
  }

  const tests = await readTests();

  const newTest = {
    id: String(Date.now()),
    name,
    numQuestions,
    answers,
    date: date || new Date().toISOString()
  };

  tests.push(newTest);
  await writeTests(tests);

  res.json(newTest);
});

// Update an existing test
app.put("/api/tests/:id", express.json({ limit: '10mb' }), async (req, res) => {
  const { id } = req.params;
  const update = req.body;

  const tests = await readTests();
  const idx = tests.findIndex(t => t.id === id);

  if (idx === -1) return res.status(404).json({ error: "Test not found" });

  // Merge old test with new fields
  tests[idx] = { ...tests[idx], ...update };

  await writeTests(tests);

  res.json(tests[idx]);
});

// Delete a test
app.delete("/api/tests/:id", async (req, res) => {
  const { id } = req.params;
  const tests = await readTests();
  const idx = tests.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Test not found" });
  tests.splice(idx, 1);
  await writeTests(tests);
  res.status(204).end();
});

// Correct test using Google Gemini AI for image analysis
app.post("/api/correct-test", express.json({ limit: '100mb' }), async (req, res) => {
  const { testId, answerKeyImage } = req.body;

  if (!testId || !answerKeyImage) {
    return res.status(400).json({ error: "Missing testId or answerKeyImage" });
  }

  try {
    const tests = await readTests();
    const test = tests.find(t => t.id === testId);

    if (!test) return res.status(404).json({ error: "Test not found" });

    // Prepare the image for Gemini
    // Remove the data URI prefix if present
    let base64Image = answerKeyImage;
    if (answerKeyImage.includes(',')) {
      base64Image = answerKeyImage.split(',')[1];
    }

    // Use Gemini 2.0 Flash model for vision tasks
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    // Create a detailed prompt for Gemini
    const prompt = `You are analyzing an answer key image for a multiple choice test with ${test.numQuestions} questions.

Please extract ONLY the correct answers in order from question 1 to question ${test.numQuestions}.

IMPORTANT INSTRUCTIONS:
- Return ONLY the letters (A, B, C, D, or E) in order, one per line
- Number of answers must be exactly ${test.numQuestions}
- Format: Just the letter, nothing else
- Example output format:
A
B
C
D
A

If the image shows answers in a different format (like "1. A", "1) A", or in columns), extract just the letters in the correct question order.

Extract the answers now:`;

    // Call Gemini with the image
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: "image/jpeg"
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // Parse the response to extract answers
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    // Extract only letters A-E from each line
    const correctAnswers = lines
      .map(line => {
        const match = line.trim().match(/\b([A-Ea-e])\b/);
        return match ? match[1].toUpperCase() : null;
      })
      .filter(answer => answer !== null)
      .slice(0, test.numQuestions);

    if (correctAnswers.length === 0) {
      return res.status(500).json({ 
        error: "Could not extract answers from the image. Please make sure the image clearly shows the answer key.",
        geminiResponse: text
      });
    }

    // If we didn't get as many answers as expected, allow partial but warn
    if (correctAnswers.length < test.numQuestions) {
      console.warn(`Gemini extracted ${correctAnswers.length} answers but test expects ${test.numQuestions}`);
    }

    // Update test answers: mark as wrong if student answer != correct answer
    let correct = 0;
    let wrong = 0;
    test.answers.forEach((ans, idx) => {
      const studentAnswer = ans?.choice;
      const correctAnswer = correctAnswers[idx];

      if (!studentAnswer || !correctAnswer) {
        // If student didn't answer or we don't have a correct answer for this index
        ans.markedWrong = false;
      } else if (studentAnswer === correctAnswer) {
        ans.markedWrong = false;
        correct++;
      } else {
        ans.markedWrong = true;
        wrong++;
      }
    });

    // Save updated test
    await writeTests(tests);

    res.json({
      success: true,
      testId,
      correct,
      wrong,
      total: test.numQuestions,
      extractedAnswers: correctAnswers,
      message: `Test corrected: ${correct}/${test.numQuestions} correct`
    });
  } catch (err) {
    console.error('Correction error:', err);
    res.status(500).json({ error: `Correction failed: ${err.message}` });
  }
});

// ---------- Start Server ----------
app.listen(PORT, () =>
  console.log(`SAT Test Manager running at http://localhost:${PORT}`)
);