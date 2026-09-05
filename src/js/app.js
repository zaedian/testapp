import { loadQuestions } from './data/questionLoader.js';
import { translations } from './data/translations.js';
import { ExamState } from './modules/examState.js';
import { ExamTimer } from './modules/timer.js';
import { UIRenderer } from './modules/ui.js';

class ExamApp {
    constructor() {
        this.ui = new UIRenderer(translations);
        this.timer = new ExamTimer("timer");
        this.questions = [];
        this.autoAdvanceEnabled = false;
        this.autoAdvanceDelay = 400; // milliseconds
        this.autoAdvanceTimeout = null;

        // Make translations globally available for UI renderer
        window.translations = translations;

        this.initLanguage();
        this.initTheme();
        this.initAutoAdvance();
        this.initEventListeners();
        this.loadQuestionsAndShowMenu();
    }

    async loadQuestionsAndShowMenu() {
        // Show loading screen
        const loadingScreen = document.getElementById("loading-screen");
        const appContainer = document.querySelector(".app-container");
        
        if (loadingScreen && appContainer) {
            loadingScreen.classList.remove("hidden");
            appContainer.style.visibility = "hidden";
        }
        
        this.questions = await loadQuestions();
        this.state = new ExamState(this.questions);
        
        // Hide loading screen and show app
        if (loadingScreen && appContainer) {
            loadingScreen.classList.add("hidden");
            appContainer.style.visibility = "visible";
        }
        
        this.showMainMenu();
    }

    initLanguage() {
        // Dutch is default unless 'en' is explicitly saved
        const savedLang = localStorage.getItem("cbr_language") || "nl";
        this.currentLang = savedLang;
        this.ui.setLanguage(this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
        
        // Update loading screen text
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) {
            const titleEl = loadingScreen.querySelector("h2");
            const subtitleEl = loadingScreen.querySelector("p");
            if (titleEl) titleEl.textContent = translations[this.currentLang].loading.title;
            if (subtitleEl) subtitleEl.textContent = translations[this.currentLang].loading.subtitle;
        }
    }

    initTheme() {
        // Dark Mode is default unless 'light' is explicitly saved
        const savedTheme = localStorage.getItem("cbr_theme") || "dark";
        this.currentTheme = savedTheme;
        this.ui.setTheme(this.currentTheme, this.currentLang);
    }

    initAutoAdvance() {
        // Load auto-advance preference from localStorage
        const savedAutoAdvance = localStorage.getItem("cbr_auto_advance");
        this.autoAdvanceEnabled = savedAutoAdvance === 'true';
        const checkbox = document.getElementById("auto-advance-toggle");
        if (checkbox) {
            checkbox.checked = this.autoAdvanceEnabled;
        }
    }

    toggleLanguage() {
        this.currentLang = this.currentLang === "nl" ? "en" : "nl";
        localStorage.setItem("cbr_language", this.currentLang);
        this.ui.setLanguage(this.currentLang);
        this.ui.setTheme(this.currentTheme, this.currentLang); // Update theme text with new language first
        this.ui.updateUIText(translations[this.currentLang]); // Then update all other text
        
        // Re-render current question if quiz is active, preserving answer state
        if (this.state && this.ui.views.quiz.classList.contains("active")) {
            const q = this.state.getCurrentQuestion();
            const hasAnswered = this.state.hasAnsweredCurrent();
            
            this.ui.renderQuestion(
                q,
                this.state.currentIndex,
                this.state.questions.length,
                (selectedIndex) => this.handleOptionSelect(selectedIndex)
            );
            
            // If question was already answered, restore the feedback state
            if (hasAnswered) {
                const userAnswer = this.state.userAnswers[this.state.currentIndex];
                const isTimeout = userAnswer === -1;
                this.ui.showAnswerFeedback(userAnswer, q.answer, q.explanation, isTimeout);
            }
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === "dark" ? "light" : "dark";
        localStorage.setItem("cbr_theme", this.currentTheme);
        this.ui.setTheme(this.currentTheme, this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
    }

    initEventListeners() {
        document.getElementById("lang-toggle").addEventListener("click", () => this.toggleLanguage());
        document.getElementById("theme-toggle").addEventListener("click", () => this.toggleTheme());
        
        // Advanced toggle button
        const advancedToggleBtn = document.getElementById("advanced-toggle-btn");
        if (advancedToggleBtn) {
            advancedToggleBtn.addEventListener("click", () => {
                const advancedSection = document.getElementById("advanced-section");
                const toggleIcon = advancedToggleBtn.querySelector(".toggle-icon");
                if (advancedSection.style.display === "none") {
                    advancedSection.style.display = "grid";
                    toggleIcon.textContent = "▲";
                } else {
                    advancedSection.style.display = "none";
                    toggleIcon.textContent = "▼";
                }
            });
        }
        
        // Auto-advance toggle
        const autoAdvanceCheckbox = document.getElementById("auto-advance-toggle");
        if (autoAdvanceCheckbox) {
            autoAdvanceCheckbox.addEventListener("change", (e) => {
                this.autoAdvanceEnabled = e.target.checked;
                localStorage.setItem("cbr_auto_advance", this.autoAdvanceEnabled);
            });
        }
        
        // Module selection checkboxes
        document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
            checkbox.addEventListener("change", () => this.updateStartButtonState());
        });
        
        // Question order radio buttons
        document.querySelectorAll("input[name='question-order']").forEach(radio => {
            radio.addEventListener("change", (e) => this.handleQuestionOrderChange(e.target.value));
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
        
        // Exit modal functionality
        const exitBtn = document.getElementById("exit-btn");
        const exitModal = document.getElementById("exit-modal");
        const modalCancelBtn = document.getElementById("modal-cancel-btn");
        const modalConfirmBtn = document.getElementById("modal-confirm-btn");
        
        if (exitBtn) {
            exitBtn.addEventListener("click", () => {
                exitModal.style.display = "flex";
            });
        }
        
        if (modalCancelBtn) {
            modalCancelBtn.addEventListener("click", () => {
                exitModal.style.display = "none";
            });
        }
        
        if (modalConfirmBtn) {
            modalConfirmBtn.addEventListener("click", () => {
                exitModal.style.display = "none";
                this.showMainMenu();
            });
        }
        
        // Close modal on overlay click
        if (exitModal) {
            exitModal.addEventListener("click", (e) => {
                if (e.target === exitModal) {
                    exitModal.style.display = "none";
                }
            });
        }
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

    getQuestionOrder() {
        const selectedOrder = document.querySelector("input[name='question-order']:checked");
        return selectedOrder ? selectedOrder.value : 'random';
    }

    handleQuestionOrderChange(order) {
        if (order === 'sequential') {
            // Set time limit to 30 for sequential mode
            document.getElementById("time-limit-override").value = "30";
            document.getElementById("time-limit-override").disabled = true;
            
            // Set question count to total available questions
            const totalQuestions = this.questions.length;
            document.getElementById("custom-question-count").value = totalQuestions;
            document.getElementById("custom-question-count").disabled = true;
            this.selectedQuestionCount = totalQuestions;
            
            // Clear mode button selection and disable them
            document.querySelectorAll(".btn-mode").forEach(btn => {
                btn.classList.remove("active");
                btn.disabled = true;
            });
            
            // Disable module checkboxes
            document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
                checkbox.disabled = true;
            });
        } else {
            // Clear custom settings when switching back to random
            document.getElementById("time-limit-override").value = "";
            document.getElementById("time-limit-override").disabled = false;
            document.getElementById("custom-question-count").value = "";
            document.getElementById("custom-question-count").disabled = false;
            this.selectedQuestionCount = null;
            
            // Enable mode buttons
            document.querySelectorAll(".btn-mode").forEach(btn => {
                btn.disabled = false;
            });
            
            // Enable module checkboxes
            document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
                checkbox.disabled = false;
            });
        }
        
        this.updateStartButtonState();
    }

    updateStartButtonState() {
        const customCount = document.getElementById("custom-question-count").value;
        const hasQuestionCount = customCount || this.selectedQuestionCount;
        const selectedModules = this.getSelectedModules();
        const hasSelectedModules = selectedModules.length > 0;
        
        // Additional validation for sequential mode - always allow start since it's auto-configured
        const questionOrder = this.getQuestionOrder();
        const isSequential = questionOrder === 'sequential';
        
        if (isSequential) {
            document.getElementById("start-btn").disabled = false;
        } else {
            document.getElementById("start-btn").disabled = !(hasQuestionCount && hasSelectedModules);
        }
    }

    showMainMenu() {
        this.timer.stop();
        
        // Clear any pending auto-advance timeout
        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }
        
        this.ui.views.menu.classList.add("active");
        this.ui.views.quiz.classList.remove("active");
        this.ui.views.results.classList.remove("active");
        
        // Reset start button state
        document.getElementById("start-btn").disabled = true;
        document.getElementById("time-limit-override").value = "";
        document.getElementById("time-limit-override").disabled = false;
        document.getElementById("custom-question-count").value = "";
        document.getElementById("custom-question-count").disabled = false;
        
        // Update custom question count placeholder to show total available questions
        const totalQuestions = this.questions.length;
        const customInput = document.getElementById("custom-question-count");
        if (customInput) {
            customInput.placeholder = `Max: ${totalQuestions}`;
            customInput.max = totalQuestions;
        }
        
        // Reset module selection checkboxes to all checked and enabled
        document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
            checkbox.checked = true;
            checkbox.disabled = false;
        });
        
        // Reset question order to random (default)
        document.querySelector("input[name='question-order'][value='random']").checked = true;
    }

    startExam(questionCount = 15) {
        this.lastQuestionCount = questionCount;
        
        // Get custom time limit if set
        const timeLimitInput = document.getElementById("time-limit-override");
        const customTimeLimit = timeLimitInput.value ? parseInt(timeLimitInput.value) : null;
        this.customTimeLimit = customTimeLimit;
        
        // Get selected modules
        const selectedModules = this.getSelectedModules();
        
        // Get question order preference
        const questionOrder = this.getQuestionOrder();
        const randomOrder = questionOrder === 'random';
        
        this.state.reset(questionCount, selectedModules, randomOrder);
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

        // Auto-advance if enabled
        if (this.autoAdvanceEnabled) {
            // Clear any existing timeout to prevent multiple advances
            if (this.autoAdvanceTimeout) {
                clearTimeout(this.autoAdvanceTimeout);
            }
            
            this.autoAdvanceTimeout = setTimeout(() => {
                this.handleNextQuestion();
            }, this.autoAdvanceDelay);
        }
    }

    handleNextQuestion() {
        // Clear any pending auto-advance timeout
        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }
        
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
        resultsData.questionResults = this.state.questionResults;
        this.ui.renderResults(resultsData);
    }
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    new ExamApp();
});