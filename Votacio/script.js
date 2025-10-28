document.addEventListener('DOMContentLoaded', () => {
    // Aquest script només gestiona la pàgina d'inici (index.html)

    const homeScreenActivityCards = document.querySelectorAll('.activity-card');
    const studentJoinForm = document.getElementById('student-join-form');

    // --- FLUX DEL PROFESSOR ---
    // Obre la nova pàgina de configuració en fer clic a una targeta
    homeScreenActivityCards.forEach(card => {
        card.addEventListener('click', () => {
            const activityType = card.dataset.activity;
            window.open(`config.html?type=${activityType}`, '_blank');
        });
    });

    // --- FLUX DE L'ALUMNE ---
    // Obre la pàgina de l'activitat directament
    studentJoinForm.addEventListener('submit', e => {
        e.preventDefault();
        const code = document.getElementById('session-code-input').value.trim().toUpperCase();
        if (code) {
            const url = `activity.html?session=${code}&mode=guest`;
            window.open(url, '_blank');
            studentJoinForm.reset();
        }
    });
});