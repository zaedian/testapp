import { loadQuestions } from './data/questionLoader.js';
import { translations } from './data/translations.js';
import { ExamState } from './modules/examState.js';
import { ExamTimer } from './modules/timer.js';
import { UIRenderer } from './modules/ui.js';

class ExamApp {
    constructor() {
        this.ui = new UIRenderer();
        this.timer = new ExamTimer("timer");
        this.questions = [];

        this.initLanguage();
        this.initTheme();
        this.initEventListeners();
        this.loadQuestionsAndShowMenu();
    }

    async loadQuestionsAndShowMenu() {
        this.questions = await loadQuestions();
        this.state = new ExamState(this.questions);
        this.showMainMenu();
    }

    initLanguage() {
        // Dutch is default unless 'en' is explicitly saved
        const savedLang = localStorage.getItem("cbr_language") || "nl";
        this.currentLang = savedLang;
        this.ui.setLanguage(this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
    }

    initTheme() {
        // Dark Mode is default unless 'light' is explicitly saved
        const savedTheme = localStorage.getItem("cbr_theme") || "dark";
        this.currentTheme = savedTheme;
        this.ui.setTheme(this.currentTheme);
    }

    toggleLanguage() {
        this.currentLang = this.currentLang === "nl" ? "en" : "nl";
        localStorage.setItem("cbr_language", this.currentLang);
        this.ui.setLanguage(this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
        
        // Re-render current question if quiz is active
        if (this.state && this.ui.views.quiz.classList.contains("active")) {
            const q = this.state.getCurrentQuestion();
            this.ui.renderQuestion(
                q,
                this.state.currentIndex,
                this.state.questions.length,
                (selectedIndex) => this.handleOptionSelect(selectedIndex)
            );
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === "dark" ? "light" : "dark";
        localStorage.setItem("cbr_theme", this.currentTheme);
        this.ui.setTheme(this.currentTheme);
    }

    initEventListeners() {
        document.getElementById("lang-toggle").addEventListener("click", () => this.toggleLanguage());
        document.getElementById("theme-toggle").addEventListener("click", () => this.toggleTheme());
        
        // Module selection checkboxes
        document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
            checkbox.addEventListener("change", () => this.updateStartButtonState());
        });
        
        // Mode selection buttons - only highlight, don't start
        document.querySelectorAll(".btn-mode").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const questionCount = parseInt(e.target.dataset.questions);
                this.selectMode(questionCount, e.target);
            });
        });
        
        // Custom count input - clear mode selection when typing
        document.getElementById("custom-question-count").addEventListener("input", (e) => {
            if (e.target.value) {
                this.selectedQuestionCount = null;
                document.querySelectorAll(".btn-mode").forEach(btn => {
                    btn.classList.remove("active");
                });
                this.updateStartButtonState();
            } else {
                this.updateStartButtonState();
            }
        });
        
        // Start button - begins exam with selected mode or custom count
        document.getElementById("start-btn").addEventListener("click", () => {
            const customCount = document.getElementById("custom-question-count").value;
            const questionCount = customCount ? parseInt(customCount) : this.selectedQuestionCount;
            if (questionCount) {
                this.startExam(questionCount);
            }
        });
        
        document.getElementById("next-btn").addEventListener("click", () => this.handleNextQuestion());
        document.getElementById("menu-btn").addEventListener("click", () => this.showMainMenu());
        document.getElementById("restart-btn").addEventListener("click", () => this.startExam(this.lastQuestionCount || 15));
    }

    selectMode(count, buttonElement) {
        this.selectedQuestionCount = count;
        
        // Update button states
        document.querySelectorAll(".btn-mode").forEach(btn => {
            btn.classList.remove("active");
        });
        buttonElement.classList.add("active");
        
        // Clear custom count input
        document.getElementById("custom-question-count").value = "";
        
        this.updateStartButtonState();
    }

    getSelectedModules() {
        const selectedModules = [];
        document.querySelectorAll(".module-checkboxes input[type='checkbox']:checked").forEach(checkbox => {
            selectedModules.push(checkbox.value);
        });
        return selectedModules;
    }

    updateStartButtonState() {
        const customCount = document.getElementById("custom-question-count").value;
        const hasQuestionCount = customCount || this.selectedQuestionCount;
        const selectedModules = this.getSelectedModules();
        const hasSelectedModules = selectedModules.length > 0;
        
        document.getElementById("start-btn").disabled = !(hasQuestionCount && hasSelectedModules);
    }

    showMainMenu() {
        this.timer.stop();
        this.ui.showView("menu");
        
        // Reset mode selection
        this.selectedQuestionCount = null;
        this.customTimeLimit = null;
        document.querySelectorAll(".btn-mode").forEach(btn => {
            btn.classList.remove("active");
        });
        document.getElementById("start-btn").disabled = true;
        document.getElementById("time-limit-override").value = "";
        document.getElementById("custom-question-count").value = "";
        
        // Reset module selection checkboxes to all checked
        document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
            checkbox.checked = true;
        });
    }

    startExam(questionCount = 15) {
        this.lastQuestionCount = questionCount;
        
        // Get custom time limit if set
        const timeLimitInput = document.getElementById("time-limit-override");
        const customTimeLimit = timeLimitInput.value ? parseInt(timeLimitInput.value) : null;
        this.customTimeLimit = customTimeLimit;
        
        // Get selected modules
        const selectedModules = this.getSelectedModules();
        
        this.state.reset(questionCount, selectedModules);
        this.ui.showView("quiz");
        this.loadCurrentQuestion();
    }

    loadCurrentQuestion() {
        this.timer.stop();
        const q = this.state.getCurrentQuestion();

        this.ui.renderQuestion(
            q,
            this.state.currentIndex,
            this.state.questions.length,
            (selectedIndex) => this.handleOptionSelect(selectedIndex)
        );

        // Use custom time limit if set, otherwise use question's default
        const timeLimit = this.customTimeLimit || q.timeLimit;

        this.timer.start(
            timeLimit,
            null,
            () => this.handleOptionSelect(-1, true)
        );
    }

    handleOptionSelect(index, isTimeout = false) {
        if (this.state.hasAnsweredCurrent()) return;

        this.timer.stop();
        this.state.setAnswer(index);

        const q = this.state.getCurrentQuestion();
        this.ui.showAnswerFeedback(index, q.answer, q.explanation, isTimeout);
    }

    handleNextQuestion() {
        if (this.state.nextQuestion()) {
            this.loadCurrentQuestion();
        } else {
            this.showResults();
        }
    }

    showResults() {
        this.timer.stop();
        this.ui.showView("results");
        const resultsData = this.state.calculateResults();
        this.ui.renderResults(resultsData);
    }
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    new ExamApp();
});