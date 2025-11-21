const express = require("express");
const fs = require("fs").promises;
const path = require("path");

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, "tests.json");

// Middleware
app.use(express.json());
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
app.post("/api/tests", async (req, res) => {
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
app.put("/api/tests/:id", async (req, res) => {
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

// ---------- Start Server ----------
app.listen(PORT, () =>
  console.log(`SAT Test Manager running at http://localhost:${PORT}`)
);
