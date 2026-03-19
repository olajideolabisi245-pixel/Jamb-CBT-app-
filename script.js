// ===== GLOBAL STATE =====
let currentUser = null;
let selectedYear = null;
let subjects = [];
let questions = [];
let currentQuestionIndex = 0;
let userAnswers = [];
let reviewMarked = [];
let timer = null;
let timeLeft = 1800; // default 30 minutes
let examSubmitted = false;
let questionsPerSubject = 40;

// ===== INITIALIZE =====
window.onload = function () {
  populateExamYears();
  populateSubjectDropdowns();
  loadLeaderboard();
  checkSavedSession();
};

function populateExamYears() {
  const yearSelect = document.getElementById("examYear");
  if (window.questionBank) {
    Object.keys(window.questionBank).forEach(year => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
  }
}

function populateSubjectDropdowns() {
  const subjectsList = ["Mathematics", "Physics", "Chemistry", "Biology", "Economics", "Literature", "Government", "History"];
  const selects = ["subject2", "subject3", "subject4"];
  selects.forEach(id => {
    const select = document.getElementById(id);
    select.innerHTML = '<option value="">-- None --</option>';
    subjectsList.forEach(sub => {
      const option = document.createElement("option");
      option.value = sub;
      option.textContent = sub;
      select.appendChild(option);
    });
  });
  // Add change listeners to prevent duplicates
  document.querySelectorAll('.subject-select').forEach(sel => {
    sel.addEventListener('change', function() {
      const selected = Array.from(document.querySelectorAll('.subject-select'))
        .map(s => s.value)
        .filter(v => v !== "");
      document.querySelectorAll('.subject-select').forEach(s => {
        Array.from(s.options).forEach(opt => {
          if (opt.value !== "" && selected.includes(opt.value) && opt.value !== s.value) {
            opt.disabled = true;
          } else {
            opt.disabled = false;
          }
        });
      });
    });
  });
}

function checkSavedSession() {
  const savedUser = localStorage.getItem("cbt_user");
  if (savedUser) {
    currentUser = savedUser;
    document.getElementById("userDisplay").innerText = `Hi, ${currentUser}`;
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("startScreen").classList.remove("hidden");
  }
}

function login() {
  const name = document.getElementById("studentName").value.trim();
  if (!name) {
    alert("Please enter your name.");
    return;
  }
  currentUser = name;
  localStorage.setItem("cbt_user", name);
  document.getElementById("userDisplay").innerText = `Hi, ${name}`;
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("startScreen").classList.remove("hidden");
}

// ===== START EXAM =====
function startExam() {
  selectedYear = document.getElementById("examYear").value;
  if (!selectedYear) {
    alert("Please select an exam year.");
    return;
  }

  // Get settings
  questionsPerSubject = parseInt(document.getElementById("questionsPerSubject").value);
  if (isNaN(questionsPerSubject) || questionsPerSubject < 1) {
    alert("Please enter a valid number of questions per subject (minimum 1).");
    return;
  }

  const examMinutes = parseInt(document.getElementById("examMinutes").value);
  if (isNaN(examMinutes) || examMinutes < 1) {
    alert("Please enter a valid time limit (minimum 1 minute).");
    return;
  }
  timeLeft = examMinutes * 60;

  // Get additional subjects (filter out empty)
  const additionalSubjects = [
    document.getElementById("subject2").value,
    document.getElementById("subject3").value,
    document.getElementById("subject4").value
  ].filter(s => s !== "");

  // Build subjects array: English always first
  subjects = ["Use of English", ...additionalSubjects];

  // Check for duplicates among additional subjects (English is unique)
  const uniqueCheck = new Set(subjects);
  if (uniqueCheck.size !== subjects.length) {
    alert("Please select different additional subjects (duplicates not allowed).");
    return;
  }

  // Load questions
  questions = [];
  for (let subject of subjects) {
    if (!window.questionBank[selectedYear] || !window.questionBank[selectedYear][subject]) {
      alert(`Questions for ${subject} in ${selectedYear} are not available.`);
      return;
    }
    let subjectQs = window.questionBank[selectedYear][subject];
    if (subjectQs.length < questionsPerSubject) {
      alert(`${subject} has only ${subjectQs.length} questions. Please reduce questions per subject or choose another subject.`);
      return;
    }
    // Shuffle and slice
    let shuffled = [...subjectQs];
    shuffleArray(shuffled);
    questions = questions.concat(shuffled.slice(0, questionsPerSubject));
  }

  // Reset state
  currentQuestionIndex = 0;
  userAnswers = new Array(questions.length).fill(null);
  reviewMarked = new Array(questions.length).fill(false);
  examSubmitted = false;

  // Clear old progress for this new exam
  localStorage.removeItem("cbtProgress");

  // Update UI
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("examScreen").classList.remove("hidden");
  document.getElementById("timer").innerText = formatTime(timeLeft);
  document.getElementById("togglePanelBtn").innerText = "📋 Hide"; // reset button

  generateNumberPanel();
  startTimer();
  showQuestion();

  // Ensure panel is visible by default (remove any hidden class)
  document.getElementById("examMain").classList.remove("panel-hidden");
}

// ===== TIMER =====
function startTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (examSubmitted) return;
    timeLeft--;
    document.getElementById("timer").innerText = formatTime(timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timer);
      submitExam();
    }
  }, 1000);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// ===== SAVE/RESTORE PROGRESS =====
function saveProgress() {
  const data = {
    answers: userAnswers,
    review: reviewMarked,
    currentIndex: currentQuestionIndex,
    timeLeft: timeLeft
  };
  localStorage.setItem("cbtProgress", JSON.stringify(data));
}

function restoreProgress() {
  const saved = localStorage.getItem("cbtProgress");
  if (saved) {
    const data = JSON.parse(saved);
    if (data.answers && data.answers.length === questions.length) {
      userAnswers = data.answers;
      reviewMarked = data.review || new Array(questions.length).fill(false);
      currentQuestionIndex = data.currentIndex || 0;
      timeLeft = data.timeLeft || timeLeft;
    }
  }
}

// ===== NAVIGATION & DISPLAY =====
function showQuestion() {
  const q = questions[currentQuestionIndex];
  document.getElementById("questionText").innerText = `${currentQuestionIndex + 1}. ${q.question}`;
  document.getElementById("currentSubject").innerText = `Subject: ${getSubjectForQuestion(currentQuestionIndex)}`;

  const optionsDiv = document.getElementById("options");
  optionsDiv.innerHTML = "";
  const letters = ["A", "B", "C", "D"];

  q.options.forEach((opt, idx) => {
    const div = document.createElement("div");
    div.className = "option-item";
    if (userAnswers[currentQuestionIndex] === idx) div.classList.add("selected");
    div.innerHTML = `<strong>${letters[idx]}.</strong> ${opt}`;
    div.onclick = () => {
      userAnswers[currentQuestionIndex] = idx;
      saveProgress();
      showQuestion();
      highlightNumber();
    };
    optionsDiv.appendChild(div);
  });

  updateProgress();
  highlightNumber();
  scrollPalette();
}

function nextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  }
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
}

// Keyboard navigation
document.addEventListener("keydown", (e) => {
  if (document.getElementById("examScreen").classList.contains("hidden")) return;
  if (e.key === "ArrowRight") nextQuestion();
  if (e.key === "ArrowLeft") prevQuestion();
});

// ===== NUMBER PANEL =====
function generateNumberPanel() {
  const panel = document.getElementById("numberPanel");
  panel.innerHTML = "";
  for (let i = 0; i < questions.length; i++) {
    const btn = document.createElement("button");
    btn.className = "q-number";
    btn.innerText = i + 1;
    btn.onclick = () => {
      currentQuestionIndex = i;
      showQuestion();
    };
    panel.appendChild(btn);
  }
  highlightNumber();
}

function highlightNumber() {
  const numbers = document.querySelectorAll(".q-number");
  numbers.forEach((btn, idx) => {
    btn.classList.remove("current", "answered", "review");
    if (userAnswers[idx] !== null) btn.classList.add("answered");
    if (reviewMarked[idx]) btn.classList.add("review");
    if (idx === currentQuestionIndex) btn.classList.add("current");
  });
}

function scrollPalette() {
  const currentBtn = document.querySelector(`.q-number.current`);
  if (currentBtn) {
    currentBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Toggle number panel visibility
function toggleNumberPanel() {
  const main = document.getElementById("examMain");
  const btn = document.getElementById("togglePanelBtn");
  main.classList.toggle("panel-hidden");
  if (main.classList.contains("panel-hidden")) {
    btn.innerText = "📋 Show";
  } else {
    btn.innerText = "📋 Hide";
  }
}

// ===== PROGRESS =====
function updateProgress() {
  const answered = userAnswers.filter(a => a !== null).length;
  const remaining = questions.length - answered;
  document.getElementById("progressText").innerText = `Answered: ${answered} | Remaining: ${remaining}`;
  const percent = (answered / questions.length) * 100;
  document.getElementById("progressBar").style.width = percent + "%";
}

// ===== ACTIONS =====
function markForReview() {
  reviewMarked[currentQuestionIndex] = !reviewMarked[currentQuestionIndex];
  saveProgress();
  highlightNumber();
}

function clearAnswer() {
  userAnswers[currentQuestionIndex] = null;
  saveProgress();
  showQuestion();
}

function confirmSubmit() {
  const unanswered = userAnswers.filter(a => a === null).length;
  let msg = "Submit exam?";
  if (unanswered > 0) msg = `You have ${unanswered} unanswered questions. Submit anyway?`;
  if (confirm(msg)) submitExam();
}

function submitExam() {
  if (examSubmitted) return;
  examSubmitted = true;
  clearInterval(timer);

  // Calculate score
  let score = 0;
  questions.forEach((q, i) => {
    if (userAnswers[i] === q.answer) score++;
  });

  // Save result to leaderboard
  saveResultToLeaderboard(score);

  // Show result screen
  document.getElementById("examScreen").classList.add("hidden");
  document.getElementById("resultScreen").classList.remove("hidden");
  document.getElementById("summaryBox").innerHTML = `<h2>Your Score: ${score} / ${questions.length}</h2>`;
  document.getElementById("studentInfo").innerHTML = `<p><strong>${currentUser}</strong> | Year: ${selectedYear} | Subjects: ${subjects.join(', ')} | Q per subject: ${questionsPerSubject}</p>`;

  // AI Hint
  const percentage = (score / questions.length) * 100;
  let hint = "";
  if (percentage >= 70) hint = "Excellent! You're well prepared.";
  else if (percentage >= 50) hint = "Good effort. Focus on your weak areas.";
  else hint = "Keep practicing. Review the topics you missed.";
  document.getElementById("aiHint").innerHTML = `<strong>AI Tip:</strong> ${hint}`;

  // Clear saved progress
  localStorage.removeItem("cbtProgress");
}

// ===== RESULT DETAILS =====
function reviewAnswers() {
  const detailsDiv = document.getElementById("resultDetails");
  if (detailsDiv.classList.contains("hidden")) {
    let html = "<h3>Detailed Review</h3>";
    questions.forEach((q, i) => {
      const userAns = userAnswers[i];
      const isCorrect = userAns === q.answer;
      html += `
        <div class="result-question">
          <p><strong>Q${i+1}:</strong> ${q.question}</p>
          <p>Your answer: ${userAns !== null ? q.options[userAns] : 'Not answered'} 
            ${isCorrect ? '<span class="correct-answer">✓ Correct</span>' : '<span class="wrong-answer">✗ Incorrect</span>'}</p>
          <p>Correct answer: ${q.options[q.answer]}</p>
        </div>
      `;
    });
    detailsDiv.innerHTML = html;
    detailsDiv.classList.remove("hidden");
  } else {
    detailsDiv.classList.add("hidden");
  }
}

// ===== LEADERBOARD =====
function saveResultToLeaderboard(score) {
  let leaderboard = JSON.parse(localStorage.getItem("cbt_leaderboard")) || [];
  leaderboard.push({
    name: currentUser,
    year: selectedYear,
    score: score,
    total: questions.length,
    date: new Date().toLocaleDateString()
  });
  // Sort by score descending, keep top 10
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 10);
  localStorage.setItem("cbt_leaderboard", JSON.stringify(leaderboard));
  displayLeaderboard();
}

function displayLeaderboard() {
  const leaderboard = JSON.parse(localStorage.getItem("cbt_leaderboard")) || [];
  const listDiv = document.getElementById("leaderboardList");
  listDiv.innerHTML = "";
  if (leaderboard.length === 0) {
    listDiv.innerHTML = "<p>No scores yet.</p>";
    return;
  }
  leaderboard.forEach((entry, idx) => {
    listDiv.innerHTML += `<div>${idx+1}. ${entry.name} - ${entry.score}/${entry.total} (${entry.year})</div>`;
  });
}

function loadLeaderboard() {
  displayLeaderboard();
}

// ===== DOWNLOAD RESULT SLIP =====
function downloadSlip() {
  let content = `JAMB CBT Pro Result Slip\n`;
  content += `Student: ${currentUser}\n`;
  content += `Year: ${selectedYear}\n`;
  content += `Subjects: ${subjects.join(', ')}\n`;
  content += `Questions per subject: ${questionsPerSubject}\n`;
  content += `Score: ${userAnswers.filter((a,i) => a === questions[i].answer).length} / ${questions.length}\n`;
  content += `Date: ${new Date().toLocaleString()}\n\n`;
  content += `Detailed Answers:\n`;
  questions.forEach((q, i) => {
    const userAns = userAnswers[i];
    const correct = q.answer;
    content += `Q${i+1}: ${userAns !== null ? q.options[userAns] : 'No answer'} | Correct: ${q.options[correct]}\n`;
  });

  const blob = new Blob([content], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `JAMB_Result_${currentUser}.txt`;
  link.click();
}

// ===== LOGOUT =====
function logout() {
  localStorage.removeItem("cbt_user");
  localStorage.removeItem("cbtProgress");
  location.reload();
}

// ===== DARK MODE =====
function toggleMode() {
  document.body.classList.toggle("dark");
  const btn = document.getElementById("themeToggle");
  btn.innerText = document.body.classList.contains("dark") ? "☀️" : "🌙";
}

// ===== HELPERS =====
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getSubjectForQuestion(index) {
  const perSubject = questionsPerSubject;
  const subjIdx = Math.floor(index / perSubject);
  return subjects[subjIdx] || "";
}
