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
        // Load voices - they may load asynchronously
        const loadVoices = () => {
            this.voicesLoaded = true;
            const voices = this.speechSynthesis.getVoices();
            console.log("Voices loaded:", voices.length);
            voices.forEach(voice => console.log(voice.name, voice.lang));
        };

        // Try to load voices immediately
        loadVoices();

        // Also listen for voiceschanged event (Chrome)
        if (this.speechSynthesis.onvoiceschanged !== undefined) {
            this.speechSynthesis.onvoiceschanged = loadVoices;
        }
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

    initFeedbackMode() {
        // Load feedback mode preference from localStorage
        const savedFeedbackMode = localStorage.getItem("cbr_feedback_mode") || "practice";
        this.feedbackMode = savedFeedbackMode;
        const radio = document.querySelector(`input[name="feedback-mode"][value="${savedFeedbackMode}"]`);
        if (radio) {
            radio.checked = true;
        }
    }

    initReadAloud() {
        // Load read-aloud preference from localStorage
        const savedReadAloud = localStorage.getItem("cbr_read_aloud");
        this.readAloudEnabled = savedReadAloud === 'true';
        const checkbox = document.getElementById("read-aloud-toggle");
        if (checkbox) {
            checkbox.checked = this.readAloudEnabled;
        }
    }

    initSoundFx() {
        // Load sound effects preference from localStorage
        const savedSoundFx = localStorage.getItem("cbr_sound_fx");
        this.soundFxEnabled = savedSoundFx === 'true';
        const checkbox = document.getElementById("sound-fx-toggle");
        if (checkbox) {
            checkbox.checked = this.soundFxEnabled;
        }
    }

    initFontSize() {
        // Load font size preference from localStorage
        const savedFontSize = localStorage.getItem("cbr_font_size");
        this.quizFontSize = savedFontSize ? parseInt(savedFontSize) : 16;
        
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
        
        // Apply font size to quiz view
        this.applyFontSize();
    }

    initTtsSpeed() {
        // Load TTS speed preference from localStorage
        const savedTtsSpeed = localStorage.getItem("cbr_tts_speed");
        this.ttsSpeed = savedTtsSpeed ? parseFloat(savedTtsSpeed) : 1.0;
        
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
        
        // Re-render results if results view is active
        if (this.state && this.ui.views.results.classList.contains("active")) {
            const resultsData = this.state.calculateResults();
            resultsData.questionResults = this.state.questionResults;
            this.ui.renderResults(resultsData);
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === "dark" ? "light" : "dark";
        localStorage.setItem("cbr_theme", this.currentTheme);
        this.ui.setTheme(this.currentTheme, this.currentLang);
        this.ui.updateUIText(translations[this.currentLang]);
    }

    initEventListeners() {
        document.getElementById("lang-toggle").addEventListener("click", () => {
            if (this.soundFxEnabled) this.playSound('click');
            this.toggleLanguage();
        });
        document.getElementById("theme-toggle").addEventListener("click", () => {
            if (this.soundFxEnabled) this.playSound('click');
            this.toggleTheme();
        });
        
        // Advanced toggle button
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
        
        // Auto-advance toggle
        const autoAdvanceCheckbox = document.getElementById("auto-advance-toggle");
        if (autoAdvanceCheckbox) {
            autoAdvanceCheckbox.addEventListener("change", (e) => {
                this.autoAdvanceEnabled = e.target.checked;
                localStorage.setItem("cbr_auto_advance", this.autoAdvanceEnabled);
            });
        }

        // Feedback mode radio buttons
        document.querySelectorAll("input[name='feedback-mode']").forEach(radio => {
            radio.addEventListener("change", (e) => {
                this.feedbackMode = e.target.value;
                localStorage.setItem("cbr_feedback_mode", this.feedbackMode);
            });
        });

        // Read-aloud toggle
        const readAloudCheckbox = document.getElementById("read-aloud-toggle");
        if (readAloudCheckbox) {
            readAloudCheckbox.addEventListener("change", (e) => {
                this.readAloudEnabled = e.target.checked;
                localStorage.setItem("cbr_read_aloud", this.readAloudEnabled);
                if (!this.readAloudEnabled) {
                    this.stopSpeech();
                }
                // Show/hide manual TTS button
                this.updateTtsButtonVisibility();
            });
        }

        // Manual TTS button
        const ttsBtn = document.getElementById("tts-btn");
        if (ttsBtn) {
            ttsBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleManualTts();
            });
        }

        // Results TTS button
        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn) {
            resultsTtsBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleResultsTts();
            });
        }

        // Results exit button
        const resultsExitBtn = document.getElementById("results-exit-btn");
        if (resultsExitBtn) {
            resultsExitBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                const exitModal = document.getElementById("exit-modal");
                if (exitModal) {
                    exitModal.style.display = "flex";
                }
            });
        }

        // Explanation TTS button (event delegation since button is dynamically created)
        document.addEventListener("click", (e) => {
            if (e.target && e.target.id === "explanation-tts-btn") {
                if (this.soundFxEnabled) this.playSound('click');
                this.toggleExplanationTts();
            }
        });

        // TTS test button
        const ttsTestBtn = document.getElementById("tts-test-btn");
        if (ttsTestBtn) {
            ttsTestBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.togglePageTts();
            });
        }

        // Reset defaults button
        const resetDefaultsBtn = document.getElementById("reset-defaults-btn");
        if (resetDefaultsBtn) {
            resetDefaultsBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                this.showResetModal();
            });
        }

        // Sound effects toggle
        const soundFxCheckbox = document.getElementById("sound-fx-toggle");
        if (soundFxCheckbox) {
            soundFxCheckbox.addEventListener("change", (e) => {
                this.soundFxEnabled = e.target.checked;
                localStorage.setItem("cbr_sound_fx", this.soundFxEnabled);
                if (this.soundFxEnabled) {
                    this.initAudioContext();
                }
            });
        }

        // Font size slider
        const fontSizeSlider = document.getElementById("font-size-slider");
        if (fontSizeSlider) {
            fontSizeSlider.addEventListener("input", (e) => {
                this.quizFontSize = parseInt(e.target.value);
                this.updateFontSizePreview();
                this.applyFontSize();
                localStorage.setItem("cbr_font_size", this.quizFontSize);
            });
        }

        // TTS speed slider
        const ttsSpeedSlider = document.getElementById("tts-speed-slider");
        if (ttsSpeedSlider) {
            ttsSpeedSlider.addEventListener("input", (e) => {
                this.ttsSpeed = parseFloat(e.target.value);
                const valueDisplay = document.getElementById("tts-speed-value");
                if (valueDisplay) {
                    valueDisplay.textContent = this.ttsSpeed.toFixed(1) + 'x';
                }
                localStorage.setItem("cbr_tts_speed", this.ttsSpeed);
                // If TTS is currently playing, restart with new speed
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
                if (this.soundFxEnabled) this.playSound('click');
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
            if (this.soundFxEnabled) this.playSound('click');
            const customCount = document.getElementById("custom-question-count").value;
            const questionCount = customCount ? parseInt(customCount) : this.selectedQuestionCount;
            if (questionCount) {
                this.startExam(questionCount);
            }
        });
        
        document.getElementById("next-btn").addEventListener("click", () => {
            if (this.soundFxEnabled) this.playSound('click');
            this.handleNextQuestion();
        });
        document.getElementById("menu-btn").addEventListener("click", () => {
            if (this.soundFxEnabled) this.playSound('click');
            this.showMainMenu();
        });
        document.getElementById("restart-btn").addEventListener("click", () => {
            if (this.soundFxEnabled) this.playSound('click');
            this.startExam(this.lastQuestionCount || 15);
        });
        
        // Exit modal functionality
        const exitBtn = document.getElementById("exit-btn");
        const exitModal = document.getElementById("exit-modal");
        const modalCancelBtn = document.getElementById("modal-cancel-btn");
        const modalConfirmBtn = document.getElementById("modal-confirm-btn");
        
        if (exitBtn) {
            exitBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                exitModal.style.display = "flex";
                this.speakModal(exitModal);
            });
        }
        
        if (modalCancelBtn) {
            modalCancelBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                exitModal.style.display = "none";
                this.stopSpeech();
            });
        }
        
        if (modalConfirmBtn) {
            modalConfirmBtn.addEventListener("click", () => {
                if (this.soundFxEnabled) this.playSound('click');
                exitModal.style.display = "none";
                this.stopSpeech();
                this.showMainMenu();
            });
        }
        
        // Close modal on overlay click
        if (exitModal) {
            exitModal.addEventListener("click", (e) => {
                if (e.target === exitModal) {
                    exitModal.style.display = "none";
                    this.stopSpeech();
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
        
        // Hide mode hint
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
        this.stopSpeech();
        
        // Clear any pending auto-advance timeout
        if (this.autoAdvanceTimeout) {
            clearTimeout(this.autoAdvanceTimeout);
            this.autoAdvanceTimeout = null;
        }
        
        this.ui.views.menu.classList.add("active");
        this.ui.views.quiz.classList.remove("active");
        this.ui.views.results.classList.remove("active");
        
        // Update start button state based on selected mode
        this.updateStartButtonState();
        
        document.getElementById("time-limit-override").value = "";
        document.getElementById("time-limit-override").disabled = false;
        
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
        
        // Initialize audio context if sound effects are enabled
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

        // Use custom time limit if set, otherwise use question's default
        const timeLimit = this.customTimeLimit || q.timeLimit;

        this.timer.start(
            timeLimit,
            null,
            () => this.handleOptionSelect(-1, true)
        );

        // Stop any existing manual TTS
        this.stopManualTts();

        // Update TTS button visibility
        this.updateTtsButtonVisibility();

        // Read aloud if enabled
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

        // Play sound effect if enabled
        if (this.soundFxEnabled) {
            this.playSound(isCorrect ? 'correct' : 'incorrect');
        }

        // Show feedback only in practice mode
        if (this.feedbackMode === 'practice') {
            this.ui.showAnswerFeedback(index, q.answer, q.explanation, isTimeout);
        } else {
            // In exam mode, just enable next button without feedback
            this.ui.enableNextButton();
        }

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
        this.stopSpeech();
        
        // Play completion sound if enabled
        if (this.soundFxEnabled) {
            this.playSound('complete');
        }
        
        this.ui.showView("results");
        const resultsData = this.state.calculateResults();
        resultsData.questionResults = this.state.questionResults;
        this.ui.renderResults(resultsData);

        // Update results TTS button visibility
        this.updateResultsTtsVisibility();
    }

    // Web Speech API methods
    speakQuestion(question) {
        if (!this.speechSynthesis || !question) return;

        // Cancel any existing speech
        this.speechSynthesis.cancel();

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";
        const langKey = this.currentLang; // Use 'nl' or 'en' for data access
        
        const scenario = typeof question.scenario === 'object' ? question.scenario[langKey] : question.scenario;
        const questionText = typeof question.question === 'object' ? question.question[langKey] : question.question;
        
        // Get options from DOM to read them in their current shuffled order
        const optionsContainer = document.getElementById("options-container");
        const optionButtons = optionsContainer ? optionsContainer.querySelectorAll(".option-btn") : [];
        
        // Build speech segments
        const speechSegments = [];
        
        if (scenario) {
            speechSegments.push({ text: scenario, isOption: false });
        }
        if (questionText) {
            speechSegments.push({ text: questionText, isOption: false });
        }
        
        // Add options as separate segments with letter and text split for pause
        optionButtons.forEach((btn) => {
            const letter = btn.dataset.letter || "";
            const text = btn.textContent || "";
            if (letter && text) {
                // Add letter as one segment
                speechSegments.push({ text: letter, isOption: true, isLetter: true });
                // Add text as separate segment for pause between letter and text
                speechSegments.push({ text: text, isOption: true, isLetter: false });
            }
        });

        if (speechSegments.length === 0) return;

        // Get voice
        const voices = this.speechSynthesis.getVoices();
        const sortedVoices = voices.sort((a, b) => {
            const aExact = a.lang === lang ? 1 : 0;
            const bExact = b.lang === lang ? 1 : 0;
            return bExact - aExact;
        });
        
        let selectedVoice = null;
        if (sortedVoices.length > 0) {
            const matchingVoice = sortedVoices.find(voice => voice.lang === lang);
            if (matchingVoice) {
                selectedVoice = matchingVoice;
            } else {
                const langPrefix = lang.split('-')[0];
                const fallbackVoice = sortedVoices.find(voice => voice.lang.startsWith(langPrefix));
                if (fallbackVoice) {
                    selectedVoice = fallbackVoice;
                } else {
                    selectedVoice = sortedVoices[0];
                }
            }
        }

        // Speak segments sequentially with pauses using onend
        let segmentIndex = 0;
        
        const speakNextSegment = () => {
            if (segmentIndex >= speechSegments.length) return;
            
            const segment = speechSegments[segmentIndex];
            const utterance = new SpeechSynthesisUtterance(segment.text);
            utterance.lang = lang;
            utterance.rate = this.ttsSpeed;
            utterance.pitch = 1;
            if (selectedVoice) {
                utterance.voice = selectedVoice;
            }
            
            utterance.onend = () => {
                segmentIndex++;
                // Calculate pause duration
                let pauseDuration;
                if (segment.isLetter) {
                    // Longer pause between letter and answer text
                    pauseDuration = 400;
                } else if (segment.isOption) {
                    // Shorter pause after option text
                    pauseDuration = 300;
                } else {
                    // Short pause after question parts
                    pauseDuration = 200;
                }
                setTimeout(speakNextSegment, pauseDuration);
            };
            
            this.speechSynthesis.speak(utterance);
        };
        
        speakNextSegment();
    }

    stopSpeech() {
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
        this.manualTtsActive = false;
        this.updateTtsButtonText();
        this.updateTtsButtonStyle();
    }

    updateTtsButtonVisibility() {
        const ttsBtn = document.getElementById("tts-btn");
        if (ttsBtn) {
            // Show button only if read-aloud is NOT enabled (manual mode)
            ttsBtn.style.display = !this.readAloudEnabled ? "inline-block" : "none";
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
            // Cancel any existing speech without resetting manual state
            if (this.speechSynthesis) {
                this.speechSynthesis.cancel();
            }
            this.manualTtsActive = true;
            this.updateTtsButtonText();
            this.updateTtsButtonStyle();
            this.speakQuestion(q);
        }
    }

    stopManualTts() {
        this.stopSpeech();
    }

    updateTtsButtonText() {
        const ttsBtn = document.getElementById("tts-btn");
        if (ttsBtn) {
            const lang = this.currentLang;
            const translations = window.translations || {};
            const quizTranslations = translations[lang]?.quiz || {};
            ttsBtn.textContent = this.manualTtsActive 
                ? (quizTranslations.stopReadingBtn || "⏹️ Stop")
                : (quizTranslations.readAloudBtn || "🔊 Read");
        }
    }

    updateTtsButtonStyle() {
        const ttsBtn = document.getElementById("tts-btn");
        if (ttsBtn) {
            if (this.manualTtsActive) {
                ttsBtn.classList.add("tts-active");
            } else {
                ttsBtn.classList.remove("tts-active");
            }
        }
    }

    updateResultsTtsVisibility() {
        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn) {
            // Show button only if read-aloud is NOT enabled (manual mode)
            resultsTtsBtn.style.display = !this.readAloudEnabled ? "inline-block" : "none";
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
            const lang = this.currentLang;
            const translations = window.translations || {};
            const quizTranslations = translations[lang]?.quiz || {};
            resultsTtsBtn.textContent = quizTranslations.stopReadingBtn || "⏹️ Stop";
        }
        this.speakResults();
    }

    stopResultsTts() {
        this.stopSpeech();
        this.resultsTtsActive = false;
        const resultsTtsBtn = document.getElementById("results-tts-btn");
        if (resultsTtsBtn) {
            resultsTtsBtn.classList.remove("tts-active");
            const lang = this.currentLang;
            const translations = window.translations || {};
            const quizTranslations = translations[lang]?.quiz || {};
            resultsTtsBtn.textContent = quizTranslations.readAloudBtn || "🔊 Read";
        }
    }

    speakResults() {
        if (!this.speechSynthesis) return;

        this.stopSpeech();

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";
        
        // Get results data from DOM to ensure we read what's displayed
        const totalQuestions = document.getElementById("stat-total")?.textContent || "0";
        const correctAnswers = document.getElementById("stat-correct")?.textContent || "0";
        const incorrectAnswers = document.getElementById("stat-incorrect")?.textContent || "0";
        const passRate = document.getElementById("stat-rate")?.textContent || "0%";
        const statusBadge = document.getElementById("status-badge")?.textContent || "";
        
        console.log("speakResults - DOM values:", { totalQuestions, correctAnswers, incorrectAnswers, passRate, statusBadge });
        
        // Also check state values for comparison
        const questionResults = this.state.questionResults || [];
        const stateTotal = questionResults.length;
        const stateCorrect = questionResults.filter(r => r.isCorrect).length;
        const stateIncorrect = stateTotal - stateCorrect;
        const statePassRate = stateTotal > 0 ? Math.round((stateCorrect / stateTotal) * 100) : 0;
        console.log("speakResults - State values:", { stateTotal, stateCorrect, stateIncorrect, statePassRate });
        
        const translations = window.translations || {};
        const resultsTranslations = translations[this.currentLang]?.results || {};
        
        let textToSpeak = "";
        textToSpeak += (resultsTranslations.title || "Exam Summary") + ". ";
        textToSpeak += (resultsTranslations.totalQuestions || "Total Questions") + ": " + totalQuestions + ". ";
        textToSpeak += (resultsTranslations.correctAnswers || "Correct Answers") + ": " + correctAnswers + ". ";
        textToSpeak += (resultsTranslations.incorrectAnswers || "Incorrect Answers") + ": " + incorrectAnswers + ". ";
        textToSpeak += (resultsTranslations.passRate || "Pass Rate") + ": " + passRate + ". ";
        textToSpeak += "Status: " + statusBadge + ". ";

        // Read detailed analysis if visible
        const detailedAnalysis = document.querySelector(".detailed-analysis");
        if (detailedAnalysis && detailedAnalysis.offsetParent !== null) {
            const analysisTitle = detailedAnalysis.querySelector("h3")?.textContent || "";
            if (analysisTitle) {
                textToSpeak += analysisTitle + ". ";
            }
            
            // Read answer cards
            const answerCards = detailedAnalysis.querySelectorAll(".answer-card");
            answerCards.forEach((card, idx) => {
                const questionNum = card.querySelector(".question-number")?.textContent || "";
                const questionText = card.querySelector(".answer-card-question")?.textContent || "";
                const status = card.querySelector(".status-badge-small")?.textContent || "";
                
                if (questionNum) textToSpeak += questionNum + ". ";
                if (questionText) textToSpeak += questionText + ". ";
                if (status) textToSpeak += status + ". ";
            });
        }

        if (!textToSpeak) return;

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang;
        utterance.rate = this.ttsSpeed;
        utterance.pitch = 1;

        // Try to find a voice matching the language
        const voices = this.speechSynthesis.getVoices();
        
        // Sort voices to prefer exact matches first
        const sortedVoices = voices.sort((a, b) => {
            const aExact = a.lang === lang ? 1 : 0;
            const bExact = b.lang === lang ? 1 : 0;
            return bExact - aExact;
        });
        
        if (sortedVoices.length > 0) {
            const matchingVoice = sortedVoices.find(voice => voice.lang === lang);
            if (matchingVoice) {
                utterance.voice = matchingVoice;
            } else {
                // Fallback: try to find any voice that matches the language prefix
                const langPrefix = lang.split('-')[0];
                const fallbackVoice = sortedVoices.find(voice => voice.lang.startsWith(langPrefix));
                if (fallbackVoice) {
                    utterance.voice = fallbackVoice;
                } else {
                    // Last resort: use the first available voice
                    utterance.voice = sortedVoices[0];
                }
            }
        }

        utterance.onend = () => {
            this.resultsTtsActive = false;
            const resultsTtsBtn = document.getElementById("results-tts-btn");
            if (resultsTtsBtn) {
                resultsTtsBtn.classList.remove("tts-active");
                const lang = this.currentLang;
                const translations = window.translations || {};
                const quizTranslations = translations[lang]?.quiz || {};
                resultsTtsBtn.textContent = quizTranslations.readAloudBtn || "🔊 Read";
            }
        };

        this.speechSynthesis.speak(utterance);
    }

    speakModal(modalElement) {
        if (!this.speechSynthesis || !modalElement) return;

        // Stop any existing speech
        this.stopSpeech();

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";
        
        // Get modal content
        const title = modalElement.querySelector("h3")?.textContent || "";
        const message = modalElement.querySelector("p")?.textContent || "";
        
        let textToSpeak = "";
        if (title) textToSpeak += title + ". ";
        if (message) textToSpeak += message + ". ";

        // Get button texts
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

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang;
        utterance.rate = this.ttsSpeed;
        utterance.pitch = 1;

        // Try to find a voice matching the language
        const voices = this.speechSynthesis.getVoices();
        
        // Sort voices to prefer exact matches first
        const sortedVoices = voices.sort((a, b) => {
            const aExact = a.lang === lang ? 1 : 0;
            const bExact = b.lang === lang ? 1 : 0;
            return bExact - aExact;
        });
        
        if (sortedVoices.length > 0) {
            const matchingVoice = sortedVoices.find(voice => voice.lang === lang);
            if (matchingVoice) {
                utterance.voice = matchingVoice;
            } else {
                // Fallback: try to find any voice that matches the language prefix
                const langPrefix = lang.split('-')[0];
                const fallbackVoice = sortedVoices.find(voice => voice.lang.startsWith(langPrefix));
                if (fallbackVoice) {
                    utterance.voice = fallbackVoice;
                } else {
                    // Last resort: use the first available voice
                    utterance.voice = sortedVoices[0];
                }
            }
        }

        this.speechSynthesis.speak(utterance);
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
            expTtsBtn.textContent = "⏹️";
        }
        this.speakExplanation();
    }

    stopExplanationTts() {
        this.stopSpeech();
        this.explanationTtsActive = false;
        const expTtsBtn = document.getElementById("explanation-tts-btn");
        if (expTtsBtn) {
            expTtsBtn.classList.remove("tts-active");
            expTtsBtn.textContent = "🔊";
        }
    }

    speakExplanation() {
        if (!this.speechSynthesis) return;

        this.stopSpeech();

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";
        
        // Get explanation text
        const explanationBox = document.getElementById("explanation-box");
        if (!explanationBox) return;
        
        let textToSpeak = "";
        
        // Get the label and explanation text
        const label = explanationBox.querySelector("strong")?.textContent || "";
        const textNodes = [];
        explanationBox.childNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                textNodes.push(node.textContent.trim());
            }
        });
        
        if (label) textToSpeak += label + ". ";
        textNodes.forEach(text => {
            textToSpeak += text + ". ";
        });

        if (!textToSpeak) return;

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = lang;
        utterance.rate = this.ttsSpeed;
        utterance.pitch = 1;

        // Try to find a voice matching the language
        const voices = this.speechSynthesis.getVoices();
        
        // Sort voices to prefer exact matches first
        const sortedVoices = voices.sort((a, b) => {
            const aExact = a.lang === lang ? 1 : 0;
            const bExact = b.lang === lang ? 1 : 0;
            return bExact - aExact;
        });
        
        if (sortedVoices.length > 0) {
            const matchingVoice = sortedVoices.find(voice => voice.lang === lang);
            if (matchingVoice) {
                utterance.voice = matchingVoice;
            } else {
                // Fallback: try to find any voice that matches the language prefix
                const langPrefix = lang.split('-')[0];
                const fallbackVoice = sortedVoices.find(voice => voice.lang.startsWith(langPrefix));
                if (fallbackVoice) {
                    utterance.voice = fallbackVoice;
                } else {
                    // Last resort: use the first available voice
                    utterance.voice = sortedVoices[0];
                }
            }
        }

        utterance.onend = () => {
            this.explanationTtsActive = false;
            const expTtsBtn = document.getElementById("explanation-tts-btn");
            if (expTtsBtn) {
                expTtsBtn.classList.remove("tts-active");
                expTtsBtn.textContent = "🔊";
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
            const lang = this.currentLang;
            const translations = window.translations || {};
            const quizTranslations = translations[lang]?.quiz || {};
            ttsTestBtn.textContent = quizTranslations.stopReadingBtn || "⏹️ Stop";
        }
        this.speakPage();
    }

    stopPageTts() {
        this.stopSpeech();
        this.pageTtsActive = false;
        const ttsTestBtn = document.getElementById("tts-test-btn");
        if (ttsTestBtn) {
            ttsTestBtn.classList.remove("tts-active");
            const lang = this.currentLang;
            const translations = window.translations || {};
            const settingsTranslations = translations[lang]?.settings || {};
            ttsTestBtn.textContent = settingsTranslations.readAloudTest || "🔊 Test Read-Aloud";
        }
    }

    speakPage() {
        if (!this.speechSynthesis) return;

        this.stopSpeech();

        const lang = this.currentLang === "nl" ? "nl-NL" : "en-US";
        
        // Get all visible text from the page
        const menuView = document.getElementById("menu-view");
        let textToSpeak = "";
        
        if (menuView && menuView.classList.contains("active")) {
            // Read the menu content
            const textElements = menuView.querySelectorAll('h1, h2, h3, p, span, strong, button:not(.btn-mode):not(.btn-secondary)');
            textElements.forEach(el => {
                if (el.offsetParent !== null) { // Only visible elements
                    const text = el.textContent.trim();
                    if (text && !text.includes('🔊') && !text.includes('⏹️')) {
                        textToSpeak += text + ". ";
                    }
                }
            });
        }

        if (textToSpeak) {
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.lang = lang;
            utterance.rate = this.ttsSpeed;
            utterance.pitch = 1;

            // Try to find a voice matching the language - voices may load asynchronously
            const voices = this.speechSynthesis.getVoices();
            
            // Sort voices to prefer exact matches first
            const sortedVoices = voices.sort((a, b) => {
                const aExact = a.lang === lang ? 1 : 0;
                const bExact = b.lang === lang ? 1 : 0;
                return bExact - aExact;
            });
            
            if (sortedVoices.length > 0) {
                const matchingVoice = sortedVoices.find(voice => voice.lang === lang);
                if (matchingVoice) {
                    utterance.voice = matchingVoice;
                } else {
                    // Fallback: try to find any voice that matches the language prefix
                    const langPrefix = lang.split('-')[0];
                    const fallbackVoice = sortedVoices.find(voice => voice.lang.startsWith(langPrefix));
                    if (fallbackVoice) {
                        utterance.voice = fallbackVoice;
                    } else {
                        // Last resort: use the first available voice
                        utterance.voice = sortedVoices[0];
                    }
                }
            }

            utterance.onend = () => {
                this.stopPageTts();
            };

            this.speechSynthesis.speak(utterance);
        }
    }

    showResetModal() {
        const exitModal = document.getElementById("exit-modal");
        const modalTitle = exitModal.querySelector("h3");
        const modalMessage = exitModal.querySelector("p");
        const modalConfirmBtn = document.getElementById("modal-confirm-btn");

        if (modalTitle && modalMessage && modalConfirmBtn) {
            const lang = this.currentLang;
            const translations = window.translations || {};
            const modalTranslations = translations[lang]?.modal || {};
            
            modalTitle.textContent = modalTranslations.resetTitle || "Reset to Defaults?";
            modalMessage.textContent = modalTranslations.resetMessage || "Are you sure you want to reset all settings to default values?";
            
            // Store original confirm handler
            const originalOnClick = modalConfirmBtn.onclick;
            
            modalConfirmBtn.onclick = () => {
                this.resetToDefaults();
                exitModal.style.display = "none";
                this.stopSpeech();
                // Restore original handler
                modalConfirmBtn.onclick = originalOnClick;
            };
            
            exitModal.style.display = "flex";
            this.speakModal(exitModal);
        }
    }

    resetToDefaults() {
        // Reset all settings to defaults
        this.feedbackMode = 'practice';
        this.readAloudEnabled = false;
        this.soundFxEnabled = false;
        this.quizFontSize = 16;
        this.ttsSpeed = 1.0;
        this.autoAdvanceEnabled = false;

        // Clear localStorage
        localStorage.removeItem("cbr_feedback_mode");
        localStorage.removeItem("cbr_read_aloud");
        localStorage.removeItem("cbr_sound_fx");
        localStorage.removeItem("cbr_font_size");
        localStorage.removeItem("cbr_tts_speed");
        localStorage.removeItem("cbr_auto_advance");

        // Update UI elements
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

        // Apply changes
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
        if (quizView) {
            // Set a multiplier based on the font size (16px = 1.0 multiplier)
            const multiplier = this.quizFontSize / 16;
            quizView.style.setProperty('--font-size-multiplier', multiplier);
        }
    }

    // Web Audio API methods
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
                oscillator.frequency.setValueAtTime(523.25, now); // C5
                oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
                oscillator.frequency.setValueAtTime(783.99, now + 0.2); // G5
                gainNode.gain.setValueAtTime(0.15, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;
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
                oscillator.frequency.setValueAtTime(523.25, now); // C5
                oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
                oscillator.frequency.setValueAtTime(783.99, now + 0.2); // G5
                oscillator.frequency.setValueAtTime(1046.50, now + 0.3); // C6
                gainNode.gain.setValueAtTime(0.15, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                oscillator.start(now);
                oscillator.stop(now + 0.5);
                break;
        }
    }
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
    new ExamApp();
});