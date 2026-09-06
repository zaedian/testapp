import { questions } from './data/questions.js';
import { translations } from './data/translations.js';
import { ExamState } from './modules/examState.js';
import { ExamTimer } from './modules/timer.js';
import { UIRenderer } from './modules/ui.js';

function supportsFlagEmoji() {
    if (typeof document === 'undefined') return true;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) return false;

    context.font = '32px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    const flagWidth = context.measureText('🇳🇱').width;
    const fallbackWidth = context.measureText('NL').width;

    return flagWidth > fallbackWidth * 1.2;
}

class ExamApp {
    safeGetStorage(key, fallbackValue) {
        try {
            const value = localStorage.getItem(key);
            return value === null ? fallbackValue : value;
        } catch (error) {
            return fallbackValue;
        }
    }

    safeSetStorage(key, value) {
        try {
            localStorage.setItem(key, String(value));
        } catch (error) {
            // Ignore storage failures gracefully in restricted/private browsing modes.
        }
    }

    safeParseInteger(value, fallbackValue) {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : fallbackValue;
    }

    safeParseFloat(value, fallbackValue) {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : fallbackValue;
    }

    constructor() {
        this.ui = new UIRenderer(translations);
        this.timer = new ExamTimer("timer");
        this.questions = [];
        this.autoAdvanceEnabled = false;
        this.autoAdvanceDelay = 400; // milliseconds
        this.autoAdvanceTimeout = null;
        this.selectedQuestionCount = null;

        // New feature states
        this.feedbackMode = 'practice'; // 'practice' or 'exam'
        this.readAloudEnabled = false;
        this.soundFxEnabled = false;
        this.speechSynthesis = window.speechSynthesis;
        this.audioContext = null;
        this.manualTtsActive = false;
        this.quizFontSize = 16;
        this.ttsSpeed = 1.0;
        this.pageTtsActive = false;
        this.voicesLoaded = false;
        this.resultsTtsActive = false;
        this.explanationTtsActive = false;

        // FIX #7: Track active speech segment loop to prevent concurrent loops
        this._speechLoopId = 0;

        // FIX #4 / #12: Dedicated confirm handler reference so it can be properly removed
        this._modalConfirmHandler = null;

        // Make translations globally available for UI renderer
        window.translations = translations;

        // Load voices asynchronously
        this.loadVoices();

        this.initLanguage();
        this.initTheme();
        this.initAutoAdvance();
        this.initFeedbackMode();
        this.initReadAloud();
        this.initSoundFx();
        this.initFontSize();
        this.initTtsSpeed();
        this.initEventListeners();
        this.loadQuestionsAndShowMenu();
        this.updateStartButtonState();
    }

    loadVoices() {
        const loadVoices = () => {
            this.voicesLoaded = true;
            const voices = this.speechSynthesis.getVoices();
            console.log("Voices loaded:", voices.length);
            voices.forEach(voice => console.log(voice.name, voice.lang));
        };

        loadVoices();

        if (this.speechSynthesis.onvoiceschanged !== undefined) {
            this.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    async loadQuestionsAndShowMenu() {
        const loadingScreen = document.getElementById("loading-screen");
        const appContainer = document.querySelector(".app-container");

        if (loadingScreen && appContainer) {
            loadingScreen.classList.remove("hidden");
            appContainer.style.visibility = "hidden";
        }

        this.questions = [...questions];
        this.state = new ExamState(this.questions);

        if (loadingScreen && appContainer) {
            loadingScreen.classList.add("hidden");
            appContainer.style.visibility = "visible";
        }

        this.showMainMenu();

        const defaultModeBtn = document.querySelector('.btn-mode[data-questions="15"]');
        if (defaultModeBtn) {
            this.selectMode(15, defaultModeBtn);
        }
    }

    updateLanguageIcon() {
        const langIcon = document.getElementById("lang-icon");
        if (!langIcon) return;

        if (!supportsFlagEmoji()) {
            langIcon.textContent = '🌐';
            return;
        }

        langIcon.textContent = this.currentLang === 'nl' ? '🇳🇱' : '🇺🇸';
    }

    initLanguage() {
        const savedLang = this.safeGetStorage("cbr_language", "nl");
        const normalizedLang = savedLang === "en" ? "en" : "nl";
        this.currentLang = normalizedLang;
        this.ui.setLanguage(this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
        this.updateLanguageIcon();

        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) {
            const titleEl = loadingScreen.querySelector("h2");
            const subtitleEl = loadingScreen.querySelector("p");
            if (titleEl) titleEl.textContent = translations[this.currentLang].loading.title;
            if (subtitleEl) subtitleEl.textContent = translations[this.currentLang].loading.subtitle;
        }
    }

    initTheme() {
        const savedTheme = this.safeGetStorage("cbr_theme", "dark");
        const normalizedTheme = savedTheme === "light" ? "light" : "dark";
        this.currentTheme = normalizedTheme;
        this.ui.setTheme(this.currentTheme, this.currentLang);
    }

    initAutoAdvance() {
        const savedAutoAdvance = this.safeGetStorage("cbr_auto_advance", "false");
        this.autoAdvanceEnabled = savedAutoAdvance === 'true';
        const checkbox = document.getElementById("auto-advance-toggle");
        if (checkbox) {
            checkbox.checked = this.autoAdvanceEnabled;
        }
    }

    initFeedbackMode() {
        const savedFeedbackMode = this.safeGetStorage("cbr_feedback_mode", "practice");
        this.feedbackMode = savedFeedbackMode === 'exam' ? 'exam' : 'practice';
        const radio = document.querySelector(`input[name="feedback-mode"][value="${this.feedbackMode}"]`);
        if (radio) {
            radio.checked = true;
        }
    }

    initReadAloud() {
        const savedReadAloud = this.safeGetStorage("cbr_read_aloud", "false");
        this.readAloudEnabled = savedReadAloud === 'true';
        const checkbox = document.getElementById("read-aloud-toggle");
        if (checkbox) {
            checkbox.checked = this.readAloudEnabled;
        }
    }

    initSoundFx() {
        const savedSoundFx = this.safeGetStorage("cbr_sound_fx", "false");
        this.soundFxEnabled = savedSoundFx === 'true';
        const checkbox = document.getElementById("sound-fx-toggle");
        if (checkbox) {
            checkbox.checked = this.soundFxEnabled;
        }
    }

    initFontSize() {
        const savedFontSize = this.safeGetStorage("cbr_font_size", "16");
        this.quizFontSize = this.safeParseInteger(savedFontSize, 16);

        const slider = document.getElementById("font-size-slider");
        const valueDisplay = document.getElementById("font-size-value");
        const preview = document.getElementById("font-size-preview");

        if (slider) {
            slider.value = this.quizFontSize;
        }
        if (valueDisplay) {
            valueDisplay.textContent = this.quizFontSize + 'px';
        }
        if (preview) {
            preview.style.fontSize = this.quizFontSize + 'px';
        }

        this.applyFontSize();
    }

    initTtsSpeed() {
        const savedTtsSpeed = this.safeGetStorage("cbr_tts_speed", "1");
        this.ttsSpeed = this.safeParseFloat(savedTtsSpeed, 1.0);

        const slider = document.getElementById("tts-speed-slider");
        const valueDisplay = document.getElementById("tts-speed-value");

        if (slider) {
            slider.value = this.ttsSpeed;
        }
        if (valueDisplay) {
            valueDisplay.textContent = this.ttsSpeed.toFixed(1) + 'x';
        }
    }

    toggleLanguage() {
        this.currentLang = this.currentLang === "nl" ? "en" : "nl";
        this.safeSetStorage("cbr_language", this.currentLang);
        this.ui.setLanguage(this.currentLang);
        this.updateLanguageIcon();
        this.ui.setTheme(this.currentTheme, this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
        this.updateTtsButtonVisibility();

        if (this.state && this.ui.views.quiz.classList.contains("active")) {
            const q = this.state.getCurrentQuestion();
            const hasAnswered = this.state.hasAnsweredCurrent();

            this.ui.renderQuestion(
                q,
                this.state.currentIndex,
                this.state.questions.length,
                (selectedIndex) => this.handleOptionSelect(selectedIndex)
            );

            if (hasAnswered) {
                const userAnswer = this.state.userAnswers[this.state.currentIndex];
                const isTimeout = userAnswer === -1;
                this.ui.showAnswerFeedback(userAnswer, q.answer, q.explanation, isTimeout);
            }
        }

        if (this.state && this.ui.views.results.classList.contains("active")) {
            const resultsData = this.state.calculateResults();
            resultsData.questionResults = this.state.questionResults;
            this.ui.renderResults(resultsData);
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === "dark" ? "light" : "dark";
        this.safeSetStorage("cbr_theme", this.currentTheme);
        this.ui.setTheme(this.currentTheme, this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
    }

    initEventListeners() {
        const langToggle = document.getElementById("lang-toggle");
        if (langToggle) {
            langToggle.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleLanguage();
            });
        }

        const themeToggle = document.getElementById("theme-toggle");
        if (themeToggle) {
            themeToggle.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleTheme();
            });
        }

        const headerExit = document.getElementById('header-exit-btn');
        if (headerExit) {
            headerExit.addEventListener('click', () => {
                if (this.soundFxEnabled) this.playSound('click');
                this._showExitModal();
            });
        }

        const headerRead = document.getElementById('header-read-btn');
        if (headerRead) {
            headerRead.addEventListener('click', () => {
                if (this.soundFxEnabled) this.playSound('click');
                const isSpeaking = this._isSpeaking();

                if (isSpeaking) {
                    this._stopAllTts();
                } else {
                    this.readAloudEnabled = !this.readAloudEnabled;
                    if (this.readAloudEnabled) {
                        if (this.ui.views.quiz.classList.contains('active')) {
                            const q = this.state.getCurrentQuestion();
                            if (q) this.speakQuestion(q);
                        } else {
                            this.speakPage();
                        }
                    } else {
                        this.stopSpeech();
                    }
                }

                const readAloudCheckbox = document.getElementById('read-aloud-toggle');
                if (readAloudCheckbox) readAloudCheckbox.checked = this.readAloudEnabled;
                this.safeSetStorage('cbr_read_aloud', this.readAloudEnabled);
                this.updateTtsButtonVisibility();
            });
        }

        const advancedToggleBtn = document.getElementById("advanced-toggle-btn");
        if (advancedToggleBtn) {
            advancedToggleBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
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

        const autoAdvanceCheckbox = document.getElementById("auto-advance-toggle");
        if (autoAdvanceCheckbox) {
            autoAdvanceCheckbox.addEventListener("change", (e) => {
                this.autoAdvanceEnabled = e.target.checked;
                this.safeSetStorage("cbr_auto_advance", this.autoAdvanceEnabled);
            });
        }

        document.querySelectorAll("input[name='feedback-mode']").forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.feedbackMode = e.target.value;
                this.safeSetStorage("cbr_feedback_mode", this.feedbackMode);
                if (this.soundFxEnabled) this.playSound('click');
            });
        });

        const readAloudCheckbox = document.getElementById("read-aloud-toggle");
        if (readAloudCheckbox) {
            readAloudCheckbox.addEventListener("change", (e) => {
                this.readAloudEnabled = e.target.checked;
                this.safeSetStorage("cbr_read_aloud", this.readAloudEnabled);
                if (!this.readAloudEnabled) {
                    this.stopSpeech();
                }
                this.updateTtsButtonVisibility();
            });
        }

        const ttsBtn = document.getElementById("tts-btn");
        if (ttsBtn) {
            ttsBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                if (this.readAloudEnabled) {
                    this.readAloudEnabled = false;
                    const readAloudCheckbox = document.getElementById("read-aloud-toggle");
                    if (readAloudCheckbox) readAloudCheckbox.checked = false;
                    this.safeSetStorage("cbr_read_aloud", this.readAloudEnabled);
                    this.stopSpeech();
                    this.updateTtsButtonVisibility();
                } else {
                    this.toggleManualTts();
                }
            });
        }

        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn) {
            resultsTtsBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleResultsTts();
            });
        }

        const resultsExitBtn = document.getElementById("results-exit-btn");
        if (resultsExitBtn) {
            resultsExitBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this._showExitModal();
            });
        }

        document.addEventListener("click", (e) => {
            const questionTtsBtn = e.target.closest ? e.target.closest("#question-tts-btn") : null;
            if (questionTtsBtn) {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleManualTts();
                return;
            }

            const explanationTtsBtn = e.target.closest ? e.target.closest("#explanation-tts-btn") : null;
            if (explanationTtsBtn) {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleExplanationTts();
            }
        });

        const ttsTestBtn = document.getElementById("tts-test-btn");
        if (ttsTestBtn) {
            ttsTestBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.togglePageTts();
            });
        }

        const resetDefaultsBtn = document.getElementById("reset-defaults-btn");
        if (resetDefaultsBtn) {
            resetDefaultsBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.showResetModal();
            });
        }

        const soundFxCheckbox = document.getElementById("sound-fx-toggle");
        if (soundFxCheckbox) {
            soundFxCheckbox.addEventListener("change", (e) => {
                this.soundFxEnabled = e.target.checked;
                this.safeSetStorage("cbr_sound_fx", this.soundFxEnabled);
                if (this.soundFxEnabled) {
                    this.initAudioContext();
                }
            });
        }

        // FIX #9: Use safeParseInteger instead of bare parseInt
        const fontSizeSlider = document.getElementById("font-size-slider");
        if (fontSizeSlider) {
            fontSizeSlider.addEventListener("input", (e) => {
                this.quizFontSize = this.safeParseInteger(e.target.value, 16);
                this.updateFontSizePreview();
                this.applyFontSize();
                this.safeSetStorage("cbr_font_size", this.quizFontSize);
            });
        }

        // FIX #9: Use safeParseFloat instead of bare parseFloat
        const ttsSpeedSlider = document.getElementById("tts-speed-slider");
        if (ttsSpeedSlider) {
            ttsSpeedSlider.addEventListener("input", (e) => {
                this.ttsSpeed = this.safeParseFloat(e.target.value, 1.0);
                const valueDisplay = document.getElementById("tts-speed-value");
                if (valueDisplay) {
                    valueDisplay.textContent = this.ttsSpeed.toFixed(1) + 'x';
                }
                this.safeSetStorage("cbr_tts_speed", this.ttsSpeed);
                if (this.speechSynthesis && this.speechSynthesis.speaking) {
                    this.speechSynthesis.cancel();
                    if (this.manualTtsActive && this.state) {
                        const q = this.state.getCurrentQuestion();
                        if (q) this.speakQuestion(q);
                    } else if (this.pageTtsActive) {
                        this.speakPage();
                    }
                }
            });
        }

        document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
            checkbox.addEventListener("change", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.updateStartButtonState();
            });
        });

        document.querySelectorAll("input[name='question-order']").forEach(radio => {
            radio.addEventListener("change", (e) => {
                if (this.soundFxEnabled) this.playSound('click');
                this.handleQuestionOrderChange(e.target.value);
            });
        });

        document.querySelectorAll(".btn-mode").forEach(btn => {
            btn.addEventListener("click", (e) => {
                if (this.soundFxEnabled) this.playSound('click');
                // FIX #9: Use safeParseInteger
                const questionCount = this.safeParseInteger(e.target.dataset.questions, 0);
                if (questionCount > 0) this.selectMode(questionCount, e.target);
            });
        });

        const customQuestionCount = document.getElementById("custom-question-count");
        if (customQuestionCount) {
            customQuestionCount.addEventListener("input", (e) => {
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
        }

        const startBtn = document.getElementById("start-btn");
        if (startBtn) {
            startBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                const customCount = customQuestionCount ? customQuestionCount.value : "";
                // FIX #10: Validate custom question count with bounds
                let questionCount = customCount
                    ? this.safeParseInteger(customCount, 0)
                    : this.selectedQuestionCount;

                if (questionCount && customCount) {
                    const maxQuestions = this.questions.length;
                    questionCount = Math.max(1, Math.min(questionCount, maxQuestions));
                }

                if (questionCount) {
                    this.startExam(questionCount);
                }
            });
        }

        const nextBtn = document.getElementById("next-btn");
        if (nextBtn) {
            nextBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.handleNextQuestion();
            });
        }

        const menuBtn = document.getElementById("menu-btn");
        if (menuBtn) {
            menuBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.showMainMenu();
            });
        }

        const restartBtn = document.getElementById("restart-btn");
        if (restartBtn) {
            restartBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.startExam(this.lastQuestionCount || 15);
            });
        }

        // FIX #4 / #12: Exit modal wired once; reset/confirm variants use _setModalConfirmAction
        const exitModal = document.getElementById("exit-modal");
        const modalCancelBtn = document.getElementById("modal-cancel-btn");
        const modalConfirmBtn = document.getElementById("modal-confirm-btn");

        if (exitModal) {
            exitModal.setAttribute('aria-hidden', 'true');
        }

        if (modalCancelBtn) {
            modalCancelBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                exitModal.style.display = "none";
                this.stopSpeech();
                if (this.readAloudEnabled) {
                    if (this.ui.views.quiz.classList.contains('active')) {
                        const q = this.state.getCurrentQuestion();
                        if (q) this.speakQuestion(q);
                    } else {
                        this.speakPage();
                    }
                }
            });
        }

        if (modalConfirmBtn) {
            // Default confirm action: exit to menu
            this._setModalConfirmAction(() => {
                exitModal.style.display = "none";
                this.stopSpeech();
                this.showMainMenu();
                if (this.readAloudEnabled) {
                    this.speakPage();
                }
            });
        }

        if (exitModal) {
            exitModal.addEventListener("click", (e) => {
                if (e.target === exitModal) {
                    exitModal.style.display = "none";
                    this.stopSpeech();
                }
            });
        }
    }

    // FIX #4 / #12: Single place to swap confirm action without .onclick patching
    _setModalConfirmAction(action) {
        const modalConfirmBtn = document.getElementById("modal-confirm-btn");
        if (!modalConfirmBtn) return;

        if (this._modalConfirmHandler) {
            modalConfirmBtn.removeEventListener("click", this._modalConfirmHandler);
        }

        this._modalConfirmHandler = () => {
            if (this.soundFxEnabled) this.playSound('click');
            action();
        };

        modalConfirmBtn.addEventListener("click", this._modalConfirmHandler);
    }

    // FIX #4 / #12: Restore the standard exit-to-menu confirm action
    _restoreDefaultModalAction() {
        const exitModal = document.getElementById("exit-modal");
        this._setModalConfirmAction(() => {
            if (exitModal) exitModal.style.display = "none";
            this.stopSpeech();
            this.showMainMenu();
            if (this.readAloudEnabled) {
                this.speakPage();
            }
        });
    }

    // Helper: show the exit modal with the default exit-to-menu confirm action
    _showExitModal() {
        const exitModal = document.getElementById("exit-modal");
        if (!exitModal) return;

        // Ensure standard exit action is wired before showing
        this._restoreDefaultModalAction();

        // Restore modal title/message to exit text (in case reset modal was shown before)
        const lang = this.currentLang;
        const t = (window.translations && window.translations[lang] && window.translations[lang].modal) || {};
        const modalTitle = exitModal.querySelector("h3");
        const modalMessage = exitModal.querySelector("p");
        if (modalTitle) modalTitle.textContent = t.exitTitle || "Exit?";
        if (modalMessage) modalMessage.textContent = t.exitMessage || "Are you sure you want to exit?";

        exitModal.style.display = "flex";
        exitModal.setAttribute('aria-hidden', 'false');
        if (this.readAloudEnabled || this.pageTtsActive) this.speakModal(exitModal);
    }

    // FIX #2: Unified helper to check whether any TTS is active
    _isSpeaking() {
        return (
            (Boolean(this.speechSynthesis && this.speechSynthesis.speaking)) ||
            this.manualTtsActive ||
            this.pageTtsActive ||
            this.resultsTtsActive ||
            this.explanationTtsActive
        );
    }

    // FIX #2: Unified helper to stop all TTS flags at once
    _stopAllTts() {
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
        // Invalidate any running segment loop
        this._speechLoopId++;

        this.manualTtsActive = false;
        this.pageTtsActive = false;
        this.resultsTtsActive = false;
        this.explanationTtsActive = false;
        this.readAloudEnabled = false;

        this._syncTtsButtonUi();
    }

    // Sync all TTS-related button UI after state changes
    _syncTtsButtonUi() {
        this.updateTtsButtonText();
        this.updateTtsButtonStyle();
        this.updateTtsButtonVisibility();

        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn && !this.resultsTtsActive) {
            resultsTtsBtn.classList.remove("tts-active");
            const t = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].quiz) || {};
            resultsTtsBtn.textContent = t.readAloudBtn || "🔊 Read";
        }

        const expTtsBtn = document.getElementById("explanation-tts-btn");
        if (expTtsBtn && !this.explanationTtsActive) {
            expTtsBtn.classList.remove("tts-active");
            expTtsBtn.innerHTML = '<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>';
        }

        const ttsTestBtn = document.getElementById("tts-test-btn");
        if (ttsTestBtn && !this.pageTtsActive) {
            ttsTestBtn.classList.remove("tts-active");
            const t = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].settings) || {};
            ttsTestBtn.textContent = t.readAloudTest || "🔊 Test Read-Aloud";
        }

        const readAloudCheckbox = document.getElementById("read-aloud-toggle");
        if (readAloudCheckbox) readAloudCheckbox.checked = this.readAloudEnabled;
    }

    selectMode(count, buttonElement) {
        this.selectedQuestionCount = count;

        document.querySelectorAll(".btn-mode").forEach(btn => {
            btn.classList.remove("active");
        });
        buttonElement.classList.add("active");

        document.getElementById("custom-question-count").value = "";

        const modeHint = document.getElementById("mode-hint");
        if (modeHint) {
            modeHint.style.display = "none";
        }

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
        const timeLimitOverride = document.getElementById("time-limit-override");
        const customQuestionCount = document.getElementById("custom-question-count");

        if (order === 'sequential') {
            if (timeLimitOverride) {
                timeLimitOverride.value = "30";
                timeLimitOverride.disabled = true;
            }

            const totalQuestions = this.questions.length;
            if (customQuestionCount) {
                customQuestionCount.value = totalQuestions;
                customQuestionCount.disabled = true;
            }
            this.selectedQuestionCount = totalQuestions;

            document.querySelectorAll(".btn-mode").forEach(btn => {
                btn.classList.remove("active");
                btn.disabled = true;
            });

            document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
                checkbox.disabled = true;
            });
        } else {
            if (timeLimitOverride) {
                timeLimitOverride.value = "";
                timeLimitOverride.disabled = false;
            }
            if (customQuestionCount) {
                customQuestionCount.value = "";
                customQuestionCount.disabled = false;
            }
            this.selectedQuestionCount = null;

            document.querySelectorAll(".btn-mode").forEach(btn => {
                btn.disabled = false;
            });

            document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
                checkbox.disabled = false;
            });
        }

        this.updateStartButtonState();
    }

    updateStartButtonState() {
        const customQuestionCount = document.getElementById("custom-question-count");
        const customCount = customQuestionCount ? customQuestionCount.value : "";
        const hasQuestionCount = customCount || this.selectedQuestionCount;
        const selectedModules = this.getSelectedModules();
        const hasSelectedModules = selectedModules.length > 0;

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
        this.stopSpeech();

        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }

        this.ui.views.menu.classList.add("active");
        this.ui.views.quiz.classList.remove("active");
        this.ui.views.results.classList.remove("active");

        this.updateStartButtonState();

        const timeLimitOverride = document.getElementById("time-limit-override");
        if (timeLimitOverride) {
            timeLimitOverride.value = "";
            timeLimitOverride.disabled = false;
        }

        const totalQuestions = this.questions.length;
        const customInput = document.getElementById("custom-question-count");
        if (customInput) {
            customInput.placeholder = `Max: ${totalQuestions}`;
            customInput.max = totalQuestions;
        }

        document.querySelectorAll(".module-checkboxes input[type='checkbox']").forEach(checkbox => {
            checkbox.checked = true;
            checkbox.disabled = false;
        });

        const randomOrderRadio = document.querySelector("input[name='question-order'][value='random']");
        if (randomOrderRadio) {
            randomOrderRadio.checked = true;
        }
        this.updateTtsButtonVisibility();
    }

    startExam(questionCount = 15) {
        this.lastQuestionCount = questionCount;

        const timeLimitInput = document.getElementById("time-limit-override");
        // FIX #11: Validate time limit — must be a positive integer
        let customTimeLimit = null;
        if (timeLimitInput && timeLimitInput.value) {
            const parsed = this.safeParseInteger(timeLimitInput.value, 0);
            customTimeLimit = parsed > 0 ? parsed : null;
        }
        this.customTimeLimit = customTimeLimit;

        const selectedModules = this.getSelectedModules();
        const questionOrder = this.getQuestionOrder();
        const randomOrder = questionOrder === 'random';

        if (this.soundFxEnabled) {
            this.initAudioContext();
        }

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
            (selectedIndex) => this.handleOptionSelect(selectedIndex),
            this.feedbackMode
        );

        const timeLimit = this.customTimeLimit || q.timeLimit;

        this.timer.start(
            timeLimit,
            null,
            () => this.handleOptionSelect(-1, true)
        );

        // FIX #2: Stop manual TTS flags cleanly without touching page/results/explanation flags
        this.stopManualTts();

        this.updateTtsButtonVisibility();

        if (this.readAloudEnabled) {
            this.speakQuestion(q);
        }
    }

    handleOptionSelect(index, isTimeout = false) {
        if (this.state.hasAnsweredCurrent()) return;

        this.timer.stop();
        this.state.setAnswer(index);

        const q = this.state.getCurrentQuestion();
        const isCorrect = index === q.answer;

        if (this.soundFxEnabled) {
            this.playSound(isCorrect ? 'correct' : 'incorrect');
        }

        if (this.feedbackMode === 'practice') {
            this.ui.showAnswerFeedback(index, q.answer, q.explanation, isTimeout);
        } else {
            this.ui.enableNextButton();
        }

        if (this.autoAdvanceEnabled) {
            if (this.autoAdvanceTimeout) {
                clearTimeout(this.autoAdvanceTimeout);
            }

            this.autoAdvanceTimeout = setTimeout(() => {
                this.handleNextQuestion();
            }, this.autoAdvanceDelay);
        }
    }

    handleNextQuestion() {
        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }

        // FIX #5: Stop explanation/results TTS before advancing
        this.stopSpeech();

        if (this.state.nextQuestion()) {
            this.loadCurrentQuestion();
        } else {
            this.showResults();
        }
    }

    showResults() {
        this.timer.stop();
        this.stopSpeech();

        if (this.soundFxEnabled) {
            this.playSound('complete');
        }

        this.ui.showView("results");
        const resultsData = this.state.calculateResults();
        resultsData.questionResults = this.state.questionResults;
        this.ui.renderResults(resultsData);

        this.updateResultsTtsVisibility();
        this.updateTtsButtonVisibility();

        if (this.readAloudEnabled) {
            this.startResultsTts();
        }
    }

    // ─── TTS helpers ────────────────────────────────────────────────────────────

    _getVoice(lang) {
        const voices = this.speechSynthesis.getVoices();
        const sorted = [...voices].sort((a, b) => (b.lang === lang ? 1 : 0) - (a.lang === lang ? 1 : 0));
        return (
            sorted.find(v => v.lang === lang) ||
            sorted.find(v => v.lang.startsWith(lang.split('-')[0])) ||
            sorted[0] ||
            null
        );
    }

    _makeUtterance(text, lang) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = this.ttsSpeed;
        utterance.pitch = 1;
        const voice = this._getVoice(lang);
        if (voice) utterance.voice = voice;
        return utterance;
    }

    // FIX #7: speakQuestion now uses a loop-id token to prevent concurrent loops
    speakQuestion(question) {
        if (!this.speechSynthesis || !question) return;

        this.speechSynthesis.cancel();

        // Increment the loop ID — any older running loop will bail out
        const loopId = ++this._speechLoopId;

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";
        const langKey = this.currentLang;

        const scenario = typeof question.scenario === 'object' ? question.scenario[langKey] : question.scenario;
        const questionText = typeof question.question === 'object' ? question.question[langKey] : question.question;

        const optionsContainer = document.getElementById("options-container");
        const optionButtons = optionsContainer ? optionsContainer.querySelectorAll(".option-btn") : [];

        const speechSegments = [];

        if (scenario) speechSegments.push({ text: scenario, isOption: false });
        if (questionText) speechSegments.push({ text: questionText, isOption: false });

        optionButtons.forEach((btn) => {
            const letter = btn.dataset.displayLetter || btn.dataset.letter || "";
            const text = btn.textContent || "";
            const cleanedText = letter ? text.replace(new RegExp(`^${letter}\\.\\s*`, 'i'), '').trim() : text.trim();
            if (letter && cleanedText) {
                speechSegments.push({ text: letter, isOption: true, isLetter: true });
                speechSegments.push({ text: cleanedText, isOption: true, isLetter: false });
            }
        });

        if (speechSegments.length === 0) return;

        let segmentIndex = 0;

        const speakNextSegment = () => {
            // FIX #7: Bail out if this loop has been superseded
            if (loopId !== this._speechLoopId) return;
            if (segmentIndex >= speechSegments.length) return;

            const segment = speechSegments[segmentIndex];
            const utterance = this._makeUtterance(segment.text, lang);

            utterance.onend = () => {
                if (loopId !== this._speechLoopId) return;
                segmentIndex++;
                const pauseDuration = segment.isLetter ? 400 : segment.isOption ? 300 : 200;
                setTimeout(speakNextSegment, pauseDuration);
            };

            this.speechSynthesis.speak(utterance);
        };

        speakNextSegment();
    }

    // FIX #2: stopSpeech only resets manual flag; use _stopAllTts to clear everything
    stopSpeech() {
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
        this._speechLoopId++;
        this.manualTtsActive = false;
        this.updateTtsButtonText();
        this.updateTtsButtonStyle();
        this.updateQuestionTtsButtonState();
    }

    updateTtsButtonVisibility() {
        const headerExit = document.getElementById('header-exit-btn');
        const headerRead = document.getElementById('header-read-btn');

        if (headerExit) {
            const showExit = this.ui && (
                this.ui.views.quiz.classList.contains('active') ||
                this.ui.views.results.classList.contains('active')
            );
            headerExit.style.display = showExit ? 'inline-block' : 'none';
            const lang = this.currentLang;
            const headerT = (window.translations && window.translations[lang] && window.translations[lang].header) || {};
            const exitLabel = headerT.exitBtn || 'Exit';
            headerExit.title = exitLabel;
            headerExit.setAttribute('aria-label', exitLabel);
        }

        if (headerRead) {
            const showRead = this.ui && (
                this.ui.views.menu.classList.contains('active') ||
                this.ui.views.quiz.classList.contains('active') ||
                this.ui.views.results.classList.contains('active')
            );
            headerRead.style.display = showRead ? 'inline-block' : 'none';
            const isSpeaking = this._isSpeaking();
            const lang = this.currentLang;
            const headerT = (window.translations && window.translations[lang] && window.translations[lang].header) || {};
            const readLabel = headerT.readAloudBtn || 'Read aloud';
            const stopLabel = headerT.stopReadingBtn || 'Stop';
            headerRead.innerHTML = `<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>`;
            headerRead.title = isSpeaking ? stopLabel : readLabel;
            headerRead.setAttribute('aria-label', isSpeaking ? stopLabel : readLabel);
            if (this.readAloudEnabled || isSpeaking) {
                headerRead.classList.add('tts-active');
            } else {
                headerRead.classList.remove('tts-active');
            }
        }
    }

    toggleManualTts() {
        if (this.manualTtsActive) {
            this.stopManualTts();
        } else {
            this.startManualTts();
        }
    }

    startManualTts() {
        const q = this.state.getCurrentQuestion();
        if (q) {
            if (this.speechSynthesis) {
                this.speechSynthesis.cancel();
            }
            this.manualTtsActive = true;
            this.updateTtsButtonText();
            this.updateTtsButtonStyle();
            this.updateTtsButtonVisibility();
            this.updateQuestionTtsButtonState();
            this.speakQuestion(q);
        }
    }

    stopManualTts() {
        this.stopSpeech();
        this.updateTtsButtonVisibility();
        this.updateQuestionTtsButtonState();
    }

    // FIX #1: updateTtsButtonText now shows distinct icons for speaking vs idle
    updateTtsButtonText() {
        const headerRead = document.getElementById('header-read-btn');
        if (headerRead) {
            const isSpeaking = this._isSpeaking();
            const lang = this.currentLang;
            const headerT = (window.translations && window.translations[lang] && window.translations[lang].header) || {};
            headerRead.innerHTML = `
                <span class="header-read-icon" aria-hidden="true">${isSpeaking ? '🔇' : '🔊'}</span>
                <span class="header-read-state-icon" aria-hidden="true">🔇</span>
            `;
            headerRead.title = isSpeaking
                ? (headerT.stopReadingBtn || 'Stop')
                : (headerT.readAloudBtn || 'Read aloud');
            headerRead.setAttribute('aria-label', isSpeaking
                ? (headerT.stopReadingBtn || 'Stop')
                : (headerT.readAloudBtn || 'Read aloud'));
        }
    }

    updateTtsButtonStyle() {
        const headerRead = document.getElementById('header-read-btn');
        if (headerRead) {
            const isSpeaking = this._isSpeaking();
            if (this.readAloudEnabled || isSpeaking) {
                headerRead.classList.add('tts-active');
            } else {
                headerRead.classList.remove('tts-active');
            }
        }
    }

    updateQuestionTtsButtonState() {
        const questionTtsBtn = document.getElementById('question-tts-btn');
        if (!questionTtsBtn) return;

        const isSpeaking = this.manualTtsActive || (
            Boolean(this.speechSynthesis && this.speechSynthesis.speaking) &&
            this.state &&
            this.ui &&
            this.ui.views &&
            this.ui.views.quiz &&
            this.ui.views.quiz.classList.contains('active')
        );

        const lang = this.currentLang;
        const readLabel = (window.translations && window.translations[lang] && window.translations[lang].header && window.translations[lang].header.readAloudBtn) || 'Read aloud';
        const stopLabel = (window.translations && window.translations[lang] && window.translations[lang].header && window.translations[lang].header.stopReadingBtn) || 'Stop';

        questionTtsBtn.innerHTML = '<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>';
        questionTtsBtn.title = isSpeaking ? stopLabel : readLabel;
        questionTtsBtn.setAttribute('aria-label', isSpeaking ? stopLabel : readLabel);

        if (isSpeaking) {
            questionTtsBtn.classList.add('tts-active');
        } else {
            questionTtsBtn.classList.remove('tts-active');
        }
    }

    updateResultsTtsVisibility() {
        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn) {
            resultsTtsBtn.style.display = "inline-block";
        }
    }

    toggleResultsTts() {
        if (this.resultsTtsActive) {
            this.stopResultsTts();
        } else {
            this.startResultsTts();
        }
    }

    startResultsTts() {
        this.resultsTtsActive = true;
        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn) {
            resultsTtsBtn.classList.add("tts-active");
            const t = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].quiz) || {};
            resultsTtsBtn.textContent = t.stopReadingBtn || "⏹️ Stop";
        }
        this.speakResults();
    }

    stopResultsTts() {
        // FIX #2: Cancel speech then update flag and button
        if (this.speechSynthesis) this.speechSynthesis.cancel();
        this._speechLoopId++;
        this.resultsTtsActive = false;
        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn) {
            resultsTtsBtn.classList.remove("tts-active");
            const t = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].quiz) || {};
            resultsTtsBtn.textContent = t.readAloudBtn || "🔊 Read";
        }
    }

    speakResults() {
        if (!this.speechSynthesis) return;

        // FIX #3: Don't call stopSpeech() here — it would reset resultsTtsActive before the utterance fires
        this.speechSynthesis.cancel();
        this._speechLoopId++;

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";

        const totalQuestions = document.getElementById("stat-total")?.textContent || "0";
        const correctAnswers = document.getElementById("stat-correct")?.textContent || "0";
        const incorrectAnswers = document.getElementById("stat-incorrect")?.textContent || "0";
        const passRate = document.getElementById("stat-rate")?.textContent || "0%";
        const statusBadge = document.getElementById("status-badge")?.textContent || "";

        const t = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].results) || {};

        let textToSpeak = "";
        textToSpeak += (t.title || "Exam Summary") + ". ";
        textToSpeak += (t.totalQuestions || "Total Questions") + ": " + totalQuestions + ". ";
        textToSpeak += (t.correctAnswers || "Correct Answers") + ": " + correctAnswers + ". ";
        textToSpeak += (t.incorrectAnswers || "Incorrect Answers") + ": " + incorrectAnswers + ". ";
        textToSpeak += (t.passRate || "Pass Rate") + ": " + passRate + ". ";
        textToSpeak += "Status: " + statusBadge + ". ";

        const detailedAnalysis = document.querySelector(".detailed-analysis");
        if (detailedAnalysis && detailedAnalysis.offsetParent !== null) {
            const analysisTitle = detailedAnalysis.querySelector("h3")?.textContent || "";
            if (analysisTitle) textToSpeak += analysisTitle + ". ";

            detailedAnalysis.querySelectorAll(".answer-card").forEach((card) => {
                const questionNum = card.querySelector(".question-number")?.textContent || "";
                const questionText = card.querySelector(".answer-card-question")?.textContent || "";
                const status = card.querySelector(".status-badge-small")?.textContent || "";
                if (questionNum) textToSpeak += questionNum + ". ";
                if (questionText) textToSpeak += questionText + ". ";
                if (status) textToSpeak += status + ". ";
            });
        }

        if (!textToSpeak) return;

        const utterance = this._makeUtterance(textToSpeak, lang);

        utterance.onend = () => {
            this.resultsTtsActive = false;
            const resultsTtsBtn = document.getElementById("results-tts-btn");
            if (resultsTtsBtn) {
                resultsTtsBtn.classList.remove("tts-active");
                const t2 = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].quiz) || {};
                resultsTtsBtn.textContent = t2.readAloudBtn || "🔊 Read";
            }
        };

        this.speechSynthesis.speak(utterance);
    }

    speakModal(modalElement) {
        if (!this.speechSynthesis || !modalElement) return;

        // FIX #3: Don't call stopSpeech() — it resets flags that shouldn't be cleared here
        this.speechSynthesis.cancel();
        this._speechLoopId++;

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";

        const title = modalElement.querySelector("h3")?.textContent || "";
        const message = modalElement.querySelector("p")?.textContent || "";

        let textToSpeak = "";
        if (title) textToSpeak += title + ". ";
        if (message) textToSpeak += message + ". ";

        const buttons = modalElement.querySelectorAll("button");
        const buttonLabels = [];
        buttons.forEach(btn => {
            const btnText = btn.textContent.trim();
            if (btnText) buttonLabels.push(btnText);
        });

        if (buttonLabels.length > 0) {
            const optionsText = this.currentLang === "nl" ? "Opties: " : "Options: ";
            textToSpeak += optionsText + buttonLabels.join(", ") + ". ";
        }

        if (!textToSpeak) return;

        this.speechSynthesis.speak(this._makeUtterance(textToSpeak, lang));
    }

    toggleExplanationTts() {
        if (this.explanationTtsActive) {
            this.stopExplanationTts();
        } else {
            this.startExplanationTts();
        }
    }

    startExplanationTts() {
        this.explanationTtsActive = true;
        const expTtsBtn = document.getElementById("explanation-tts-btn");
        if (expTtsBtn) {
            expTtsBtn.classList.add("tts-active");
            expTtsBtn.innerHTML = '<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>';
            const lang = this.currentLang;
            const stopLabel = (window.translations && window.translations[lang] && window.translations[lang].header && window.translations[lang].header.stopReadingBtn) || 'Stop';
            expTtsBtn.title = stopLabel;
            expTtsBtn.setAttribute('aria-label', stopLabel);
        }
        this.updateTtsButtonVisibility();
        this.speakExplanation();
    }

    stopExplanationTts() {
        if (this.speechSynthesis) this.speechSynthesis.cancel();
        this._speechLoopId++;
        this.explanationTtsActive = false;
        const expTtsBtn = document.getElementById("explanation-tts-btn");
        if (expTtsBtn) {
            expTtsBtn.classList.remove("tts-active");
            expTtsBtn.innerHTML = '<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>';
            const lang = this.currentLang;
            const readLabel = (window.translations && window.translations[lang] && window.translations[lang].header && window.translations[lang].header.readAloudBtn) || 'Read aloud';
            expTtsBtn.title = readLabel;
            expTtsBtn.setAttribute('aria-label', readLabel);
        }
        this.updateTtsButtonVisibility();
    }

    speakExplanation() {
        if (!this.speechSynthesis) return;

        // FIX #3: Cancel directly without calling stopSpeech()
        this.speechSynthesis.cancel();
        this._speechLoopId++;

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";

        const explanationBox = document.getElementById("explanation-box");
        if (!explanationBox) return;

        let textToSpeak = "";
        const label = explanationBox.querySelector("strong")?.textContent || "";
        const explanationParagraph = explanationBox.querySelector("p")?.textContent || "";
        const mergedText = [label, explanationParagraph]
            .filter(Boolean)
            .map(text => text.replace(/\s+/g, ' ').trim())
            .join('. ');

        if (mergedText) textToSpeak += mergedText + ". ";

        if (!textToSpeak) return;

        const utterance = this._makeUtterance(textToSpeak, lang);

        utterance.onend = () => {
            this.explanationTtsActive = false;
            const expTtsBtn = document.getElementById("explanation-tts-btn");
            if (expTtsBtn) {
                expTtsBtn.classList.remove("tts-active");
                expTtsBtn.innerHTML = '<span class="header-read-icon" aria-hidden="true">🔊</span><span class="header-read-state-icon" aria-hidden="true">🔇</span>';
                const lang = this.currentLang;
                const readLabel = (window.translations && window.translations[lang] && window.translations[lang].header && window.translations[lang].header.readAloudBtn) || 'Read aloud';
                expTtsBtn.title = readLabel;
                expTtsBtn.setAttribute('aria-label', readLabel);
            }
        };

        this.speechSynthesis.speak(utterance);
    }

    togglePageTts() {
        if (this.pageTtsActive) {
            this.stopPageTts();
        } else {
            this.startPageTts();
        }
    }

    startPageTts() {
        this.pageTtsActive = true;
        const ttsTestBtn = document.getElementById("tts-test-btn");
        if (ttsTestBtn) {
            ttsTestBtn.classList.add("tts-active");
            const t = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].quiz) || {};
            ttsTestBtn.textContent = t.stopReadingBtn || "⏹️ Stop";
        }
        this.speakPage();
    }

    stopPageTts() {
        // FIX #6: Cancel speech first, then update flag and button
        if (this.speechSynthesis) this.speechSynthesis.cancel();
        this._speechLoopId++;
        this.pageTtsActive = false;
        const ttsTestBtn = document.getElementById("tts-test-btn");
        if (ttsTestBtn) {
            ttsTestBtn.classList.remove("tts-active");
            const t = (window.translations && window.translations[this.currentLang] && window.translations[this.currentLang].settings) || {};
            ttsTestBtn.textContent = t.readAloudTest || "🔊 Test Read-Aloud";
        }
    }

    speakPage() {
        if (!this.speechSynthesis) return;

        // FIX #6: Cancel directly without calling stopSpeech() to preserve pageTtsActive
        this.speechSynthesis.cancel();
        this._speechLoopId++;

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";
        const menuView = document.getElementById("menu-view");
        let textToSpeak = "";

        if (menuView && menuView.classList.contains("active")) {
            const textElements = menuView.querySelectorAll('h1, h2, h3, p, span, strong, button:not(.btn-mode):not(.btn-secondary)');
            const seen = new Set();
            textElements.forEach(el => {
                if (el.offsetParent !== null) {
                    const text = el.textContent.trim();
                    if (!text) return;
                    if (text.includes('🔊') || text.includes('⏹️')) return;
                    if (seen.has(text)) return;
                    seen.add(text);
                    textToSpeak += text + ". ";
                }
            });
        }

        if (!textToSpeak) return;

        const utterance = this._makeUtterance(textToSpeak, lang);

        utterance.onend = () => {
            this.stopPageTts();
        };

        this.speechSynthesis.speak(utterance);
    }

    showResetModal() {
        const exitModal = document.getElementById("exit-modal");
        if (!exitModal) return;

        const modalTitle = exitModal.querySelector("h3");
        const modalMessage = exitModal.querySelector("p");

        const lang = this.currentLang;
        const t = (window.translations && window.translations[lang] && window.translations[lang].modal) || {};

        if (modalTitle) modalTitle.textContent = t.resetTitle || "Reset to Defaults?";
        if (modalMessage) modalMessage.textContent = t.resetMessage || "Are you sure you want to reset all settings to default values?";

        // FIX #4: Use _setModalConfirmAction so the listener is properly replaced
        this._setModalConfirmAction(() => {
            this.resetToDefaults();
            exitModal.style.display = "none";
            exitModal.setAttribute('aria-hidden', 'true');
            this.stopSpeech();
            // Restore the standard exit action for subsequent modal opens
            this._restoreDefaultModalAction();
        });

        exitModal.style.display = "flex";
        exitModal.setAttribute('aria-hidden', 'false');
        this.speakModal(exitModal);
    }

    resetToDefaults() {
        this.feedbackMode = 'practice';
        this.readAloudEnabled = false;
        this.soundFxEnabled = false;
        this.quizFontSize = 16;
        this.ttsSpeed = 1.0;
        this.autoAdvanceEnabled = false;

        try {
            localStorage.removeItem("cbr_feedback_mode");
            localStorage.removeItem("cbr_read_aloud");
            localStorage.removeItem("cbr_sound_fx");
            localStorage.removeItem("cbr_font_size");
            localStorage.removeItem("cbr_tts_speed");
            localStorage.removeItem("cbr_auto_advance");
        } catch (error) {
            // Ignore storage failures gracefully.
        }

        const feedbackPractice = document.querySelector("input[name='feedback-mode'][value='practice']");
        if (feedbackPractice) feedbackPractice.checked = true;

        const readAloudCheckbox = document.getElementById("read-aloud-toggle");
        if (readAloudCheckbox) readAloudCheckbox.checked = false;

        const soundFxCheckbox = document.getElementById("sound-fx-toggle");
        if (soundFxCheckbox) soundFxCheckbox.checked = false;

        const autoAdvanceCheckbox = document.getElementById("auto-advance-toggle");
        if (autoAdvanceCheckbox) autoAdvanceCheckbox.checked = false;

        const fontSizeSlider = document.getElementById("font-size-slider");
        if (fontSizeSlider) fontSizeSlider.value = 16;

        const fontSizeValue = document.getElementById("font-size-value");
        if (fontSizeValue) fontSizeValue.textContent = "16px";

        const fontSizePreview = document.getElementById("font-size-preview");
        if (fontSizePreview) fontSizePreview.style.fontSize = "16px";

        const ttsSpeedSlider = document.getElementById("tts-speed-slider");
        if (ttsSpeedSlider) ttsSpeedSlider.value = 1.0;

        const ttsSpeedValue = document.getElementById("tts-speed-value");
        if (ttsSpeedValue) ttsSpeedValue.textContent = "1.0x";

        this.applyFontSize();
        this.stopSpeech();
        this.stopPageTts();
    }

    updateFontSizePreview() {
        const valueDisplay = document.getElementById("font-size-value");
        const preview = document.getElementById("font-size-preview");

        if (valueDisplay) {
            valueDisplay.textContent = this.quizFontSize + 'px';
        }
        if (preview) {
            preview.style.fontSize = this.quizFontSize + 'px';
        }
    }

    applyFontSize() {
        const quizView = document.getElementById("quiz-view");
        const resultsView = document.getElementById("results-view");
        const explanationBox = document.getElementById("explanation-box");
        const sizePx = this.quizFontSize + 'px';
        if (quizView) quizView.style.fontSize = sizePx;
        if (resultsView) resultsView.style.fontSize = sizePx;
        if (explanationBox) explanationBox.style.fontSize = sizePx;
    }

    // ─── Audio ───────────────────────────────────────────────────────────────────

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    playSound(type) {
        if (!this.soundFxEnabled || !this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const now = this.audioContext.currentTime;

        switch (type) {
            case 'click':
                oscillator.frequency.setValueAtTime(800, now);
                oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.05);
                gainNode.gain.setValueAtTime(0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;

            case 'correct':
                // FIX #8: Use separate oscillators for each note so all three are audible
                [
                    { freq: 523.25, start: now },
                    { freq: 659.25, start: now + 0.12 },
                    { freq: 783.99, start: now + 0.24 }
                ].forEach(({ freq, start }) => {
                    const osc = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(this.audioContext.destination);
                    osc.frequency.setValueAtTime(freq, start);
                    gain.gain.setValueAtTime(0.15, start);
                    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.1);
                    osc.start(start);
                    osc.stop(start + 0.1);
                });
                // Disconnect the original oscillator/gain (never started)
                oscillator.disconnect();
                gainNode.disconnect();
                return;

            case 'incorrect':
                oscillator.frequency.setValueAtTime(200, now);
                oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.15);
                gainNode.gain.setValueAtTime(0.15, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                oscillator.type = 'sawtooth';
                oscillator.start(now);
                oscillator.stop(now + 0.15);
                break;

            case 'complete':
                // FIX #8: Use separate oscillators for each note in the fanfare
                [
                    { freq: 523.25, start: now },
                    { freq: 659.25, start: now + 0.12 },
                    { freq: 783.99, start: now + 0.24 },
                    { freq: 1046.50, start: now + 0.36 }
                ].forEach(({ freq, start }) => {
                    const osc = this.audioContext.createOscillator();
                    const gain = this.audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(this.audioContext.destination);
                    osc.frequency.setValueAtTime(freq, start);
                    gain.gain.setValueAtTime(0.15, start);
                    gain.gain.exponentialRampToValueAtTime(0.01, start + 0.1);
                    osc.start(start);
                    osc.stop(start + 0.1);
                });
                oscillator.disconnect();
                gainNode.disconnect();
                return;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    new ExamApp();
});