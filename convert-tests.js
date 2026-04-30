// convert-tests.js
// Usage:
// node convert-tests.js input.json output-folder

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const inputFile = process.argv[2] || "input.json";
const outputDir = process.argv[3] || "exported-tests";

// Change these if needed
const DEFAULT_FOLDER_ID = "7ec8eef7-55d9-4be7-a4c2-efcd66e1cc8b";
const DEFAULT_TIMER_ENABLED = false;
const DEFAULT_TIMER_MINUTES = 70;
const DEFAULT_MAX_SCALED_SCORE = 800;

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const input = JSON.parse(fs.readFileSync(inputFile, "utf8"));

input.forEach((test, testIndex) => {
  const answers = {};
  const corrections = {};
  const guessed = [];
  const requiresStudy = [];

  let rawScore = 0;

  test.answers.forEach((ans, index) => {
    const qNum = String(index + 1);

    // Answers
    answers[qNum] = ans.choice || "";

    // Guessed questions
    if (ans.guessed) {
      guessed.push(index + 1);
    }

    // Requires study questions
    if (ans.requiresStudy) {
      requiresStudy.push(index + 1);
    }

    // Corrections
    const isWrong = ans.markedWrong === true;

    corrections[qNum] = {
      correct: !isWrong,
      correctAnswer: isWrong ? (ans.correctAnswer || "") : "",
    };

    if (!isWrong) {
      rawScore++;
    }
  });

  const scaledScore = Math.round(
    (rawScore / test.numQuestions) * DEFAULT_MAX_SCALED_SCORE
  );

  const convertedTest = {
    id: crypto.randomUUID(),
    createdAt: test.date || new Date().toISOString(),
    name: test.name,
    numQuestions: test.numQuestions,
    timerEnabled: DEFAULT_TIMER_ENABLED,
    timerMinutes: DEFAULT_TIMER_MINUTES,
    folderId: DEFAULT_FOLDER_ID,

    answers,
    guessed,
    requiresStudy,
    corrections,

    rawScore,
    scaledScore,
    maxScaledScore: DEFAULT_MAX_SCALED_SCORE,
  };

  // Safe filename
  const safeName = test.name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "_");

  const fileName = `${safeName || `test_${testIndex + 1}`}.json`;

  fs.writeFileSync(
    path.join(outputDir, fileName),
    JSON.stringify(convertedTest, null, 2)
  );

  console.log(`Exported: ${fileName}`);
});

console.log(`\nDone. Exported ${input.length} tests to "${outputDir}"`);
