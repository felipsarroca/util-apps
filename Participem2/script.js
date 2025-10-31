document.addEventListener('DOMContentLoaded', () => {
    // Aquest script només gestiona la pàgina d'inici (index.html)

    const addPressListener = (element, handler, options = {}) => {
        if (!element) return;

        if (window.PointerEvent) {
            const pointerHandler = (event) => {
                if (event.pointerType === 'mouse' && event.button !== 0) return;
                if (event.isPrimary === false) return;
                handler.call(element, event);
            };
            element.addEventListener('pointerup', pointerHandler, options);
            return;
        }

        let touchTriggered = false;
        const clickHandler = (event) => {
            if (touchTriggered) {
                touchTriggered = false;
                return;
            }
            handler.call(element, event);
        };
        const touchHandler = (event) => {
            touchTriggered = true;
            event.preventDefault();
            handler.call(element, event);
        };

        element.addEventListener('click', clickHandler, options);
        const touchOptions = { passive: false };
        if (options.capture) touchOptions.capture = true;
        if (options.once) touchOptions.once = true;
        element.addEventListener('touchend', touchHandler, touchOptions);
    };

    const homeScreenActivityCards = document.querySelectorAll('.activity-card');
    const studentJoinForm = document.getElementById('student-join-form');

    // --- FLUX DEL PROFESSOR ---
    // Obre la nova pàgina de configuració en fer clic a una targeta
    homeScreenActivityCards.forEach(card => {
        addPressListener(card, () => {
            const activityType = card.dataset.activity;
            window.location.href = `config.html?type=${activityType}`;
        });
    });

    // --- FLUX DE L'ALUMNE ---
    // Obre la pàgina de l'activitat directament
    studentJoinForm.addEventListener('submit', e => {
        e.preventDefault();
        const code = document.getElementById('session-code-input').value.trim().toUpperCase();
        if (!code) return;
        const url = `activity.html?session=${code}&mode=guest`;
        window.location.href = url;
    });
});
