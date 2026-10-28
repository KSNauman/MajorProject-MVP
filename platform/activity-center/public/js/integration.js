/**
 * EduVision Platform Integration Client
 * Handles token negotiation, score submission, character animations, modal overlays,
 * dynamic navbar buttons, and fun-mode zero-score play.
 */
class EduVisionClient {
    constructor() {
        const params = new URLSearchParams(window.location.search);
        this.token = params.get('token');
        this.assignmentId = params.get('assignmentId');
        this.mode = params.get('mode');
        this.returnUrl = params.get('returnUrl') || 'http://localhost:5173/';
        this.apiBase = 'http://localhost:4000/api';
        this.startTime = Date.now();
        this.hasReported = false;

        // Fun mode is active if explicitly set to 'fun' OR if no token and no assignmentId
        this.isFunMode = this.mode === 'fun' || (!this.token && !this.assignmentId);
        this.isTeacherAssigned = Boolean(this.token && this.assignmentId && !this.isFunMode);

        this.setupNavButtons();
    }

    setupNavButtons() {
        // Do not alter nav buttons on the hub index page itself
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
            return;
        }

        const updateButtons = () => {
            const exitBtn = document.getElementById('navExitBtn') || 
                document.querySelector('.nav-controls a.btn-secondary') ||
                document.querySelector('.nav-controls a[href*="index.html"]');

            if (exitBtn) {
                if (this.isTeacherAssigned) {
                    // Teacher assigned: remove "Exit Hub" and add "Back to Portal"
                    exitBtn.textContent = 'Back to Portal 🎒';
                    exitBtn.href = this.returnUrl;
                    exitBtn.title = 'Back to your assignments in the portal';
                } else {
                    // Fun mode: provide "Exit Activity" button that functions same as "Exit Hub"
                    exitBtn.textContent = 'Exit Activity 🏠';
                    const funHubUrl = `/index.html?mode=fun&returnUrl=${encodeURIComponent(this.returnUrl)}`;
                    exitBtn.href = funHubUrl;
                    exitBtn.title = 'Back to Activity Hub';
                }
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', updateButtons);
        } else {
            updateButtons();
        }
        window.addEventListener('load', updateButtons);
    }

    async reportResult({ score = 100, status = 'COMPLETED', details = {} } = {}) {
        // In Fun Mode (or standalone mode), do NOT provide or submit any score to the kid
        if (this.isFunMode || !this.token) {
            console.log('[EduVision] Fun mode / standalone active: Score submission skipped. No score recorded for child.', { score, status, details });
            return { success: true, funMode: this.isFunMode, standalone: !this.token };
        }

        if (this.hasReported && status === 'COMPLETED') {
            console.log('[EduVision] Completion already reported for this session.');
            return { success: true, alreadyReported: true };
        }

        try {
            const timeSpent = Math.round((Date.now() - this.startTime) / 1000);
            const payload = {
                assignmentId: this.assignmentId,
                score,
                status,
                details: {
                    ...details,
                    timeSpentSeconds: timeSpent,
                    submittedAt: new Date().toISOString()
                }
            };

            const res = await fetch(`${this.apiBase}/integrations/results`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            console.log('[EduVision] Result recorded successfully:', data);
            if (status === 'COMPLETED') {
                this.hasReported = true;
            }
            return data;
        } catch (e) {
            console.error('[EduVision] Error submitting result:', e);
            return { error: e.message };
        }
    }

    /**
     * Show victory celebration modal with Animation Engine Character
     */
    showCelebration({
        score = 100,
        stars = 3,
        title = 'Spectacular Job! 🌟',
        message = 'You completed the activity with flying colors!',
        details = {},
        onRestart = null
    } = {}) {
        if (window.soundEngine && typeof window.soundEngine.playFanfare === 'function') {
            window.soundEngine.playFanfare();
        }

        // Submits result only if teacher assigned; automatically skipped in fun mode
        this.reportResult({ score, status: 'COMPLETED', details });

        // Trigger confetti
        this.launchConfetti();

        const returnDestination = this.isTeacherAssigned 
            ? this.returnUrl 
            : `/index.html?mode=fun&returnUrl=${encodeURIComponent(this.returnUrl)}`;
        
        const returnLabel = this.isTeacherAssigned ? 'Back to Portal 🎒' : 'Exit to Activity Hub 🏠';

        // Render celebratory modal
        const modal = document.createElement('div');
        modal.className = 'eduvision-overlay';
        modal.innerHTML = `
            <div class="eduvision-modal celebrate-modal">
                <div class="stars-banner">
                    ${'⭐'.repeat(stars)}
                </div>
                <h2 class="modal-title">${title}</h2>
                <p class="modal-subtitle">${message}</p>
                
                <!-- Animation Engine Integration -->
                <div class="animation-engine-display">
                    <img src="/characters/rahim/animations/jump.gif" 
                         alt="Rahim Celebrating" 
                         class="character-anim-gif"
                         onerror="this.src='/characters/rahim/animations/wave.gif'" />
                    <div class="character-caption">✨ Rahim is super proud of you! ✨</div>
                </div>

                ${this.isFunMode ? `
                <div class="score-card" style="background:#fdf4ff; border-color:#e879f9;">
                    <div class="score-item" style="grid-column: 1 / -1; text-align:center;">
                        <span class="score-label" style="color:#a21caf; font-weight:700;">🎈 Free Play / Fun Mode</span>
                        <span class="score-value" style="font-size:1.05rem; color:#86198f;">Played for fun! No grade or score recorded. 🎨</span>
                    </div>
                </div>
                ` : `
                <div class="score-card">
                    <div class="score-item">
                        <span class="score-label">Final Score</span>
                        <span class="score-value highlight">${score} pts</span>
                    </div>
                    <div class="score-item">
                        <span class="score-label">Stars</span>
                        <span class="score-value">${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</span>
                    </div>
                    ${details && details.accuracy !== undefined ? `
                    <div class="score-item">
                        <span class="score-label">Accuracy</span>
                        <span class="score-value">${details.accuracy}%</span>
                    </div>` : ''}
                </div>
                `}

                <div class="modal-actions">
                    <button class="btn btn-secondary" id="modalRestartBtn">Play Again 🔄</button>
                    <a href="${returnDestination}" class="btn btn-primary">${returnLabel}</a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('modalRestartBtn').onclick = () => {
            modal.remove();
            if (onRestart) onRestart();
            else window.location.reload();
        };
    }

    /**
     * Show gentle encouraging modal with Animation Engine Character on retry / mistakes
     */
    showEncouragement({
        score = 50,
        title = 'Good Try! Keep Going! 💪',
        message = "Practice makes perfect! Rahim is cheering you on!",
        details = {},
        onRetry = null
    } = {}) {
        if (window.soundEngine && typeof window.soundEngine.playSoftBounce === 'function') {
            window.soundEngine.playSoftBounce();
        }

        const returnDestination = this.isTeacherAssigned 
            ? this.returnUrl 
            : `/index.html?mode=fun&returnUrl=${encodeURIComponent(this.returnUrl)}`;
        
        const returnLabel = this.isTeacherAssigned ? 'Back to Portal 🎒' : 'Exit to Activity Hub 🏠';

        const modal = document.createElement('div');
        modal.className = 'eduvision-overlay';
        modal.innerHTML = `
            <div class="eduvision-modal retry-modal">
                <div class="stars-banner">
                    ⭐ Keep Trying!
                </div>
                <h2 class="modal-title">${title}</h2>
                <p class="modal-subtitle">${message}</p>
                
                <!-- Animation Engine Integration -->
                <div class="animation-engine-display">
                    <img src="/characters/rahim/animations/idel.gif" 
                         alt="Rahim Encouraging" 
                         class="character-anim-gif"
                         onerror="this.src='/characters/rahim/animations/walk_in_circle.gif'" />
                    <div class="character-caption">💡 You can do it! Give it another shot!</div>
                </div>

                ${!this.isFunMode ? `
                <div class="score-card">
                    <div class="score-item">
                        <span class="score-label">Points Earned</span>
                        <span class="score-value highlight">${score} pts</span>
                    </div>
                </div>
                ` : ''}

                <div class="modal-actions">
                    <button class="btn btn-primary" id="modalRetryBtn">Try Again 🔄</button>
                    <a href="${returnDestination}" class="btn btn-secondary">${returnLabel}</a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('modalRetryBtn').onclick = () => {
            modal.remove();
            if (onRetry) onRetry();
            else window.location.reload();
        };
    }

    launchConfetti() {
        const canvas = document.createElement('canvas');
        canvas.className = 'confetti-canvas';
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = [];
        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        for (let i = 0; i < 90; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                w: Math.random() * 10 + 6,
                h: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 3,
                vy: Math.random() * 4 + 3,
                rotation: Math.random() * 360,
                vrot: (Math.random() - 0.5) * 10
            });
        }

        let animationFrame;
        let start = Date.now();
        const render = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.vrot;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            if (Date.now() - start < 4500) {
                animationFrame = requestAnimationFrame(render);
            } else {
                cancelAnimationFrame(animationFrame);
                canvas.remove();
            }
        };
        render();
    }
}

// Global Client Instance
window.eduvisionClient = new EduVisionClient();

// Global Bridge Functions Expected by All Activities
window.reportActivityResult = function(activityId, data = {}) {
    if (!window.eduvisionClient) return Promise.resolve();
    const score = data.score !== undefined ? data.score : 100;
    const status = data.completed ? 'COMPLETED' : (data.status || 'COMPLETED');
    return window.eduvisionClient.reportResult({
        score,
        status,
        details: { activityId, ...data }
    });
};

window.showCelebrationModal = function(options = {}) {
    if (!window.eduvisionClient) return;
    const stars = options.stars !== undefined ? options.stars : 3;
    const score = options.score !== undefined ? options.score : 100;
    const title = options.title || 'Spectacular Job! 🌟';
    const message = options.customMessage || options.message || 'You completed the activity with flying colors!';
    window.eduvisionClient.showCelebration({
        score,
        stars,
        title,
        message,
        details: options,
        onRestart: options.onRestart || null
    });
};
