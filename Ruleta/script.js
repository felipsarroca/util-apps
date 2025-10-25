const canvas = document.getElementById('roulette-canvas');
const ctx = canvas.getContext('2d');
const spinButton = document.getElementById('spin-button');
const updateButton = document.getElementById('update-button');
const inputTextArea = document.getElementById('input-textarea');
const resultText = document.getElementById('result-text');
const removeButton = document.getElementById('remove-button');
const resetButton = document.getElementById('reset-button');

let items = [];
let colors = [];
let startAngle = 0;
let arc = 0;
let spinTimeout = null;
let spinAngleStart = 0;
let spinTime = 0;
let spinTimeTotal = 0;

// IMPORTANT: You need to provide the ruleta.mp3 file for the sound to work.
const spinSound = new Audio('ruleta.mp3');

function drawRoulette() {
    arc = Math.PI / (items.length / 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;

    for (let i = 0; i < items.length; i++) {
        const angle = startAngle + i * arc;
        ctx.fillStyle = colors[i];

        ctx.beginPath();
        ctx.arc(250, 250, 250, angle, angle + arc, false);
        ctx.arc(250, 250, 0, angle + arc, angle, true);
        ctx.stroke();
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "white";
        ctx.translate(250 + Math.cos(angle + arc / 2) * 150, 250 + Math.sin(angle + arc / 2) * 150);
        ctx.rotate(angle + arc / 2 + Math.PI / 2);
        const text = items[i];
        ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
        ctx.restore();
    }
}

function rotate() {
    spinTime += 30;
    spinSound.play();
    if (spinTime >= spinTimeTotal) {
        stopRotate();
        return;
    }
    const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180);
    drawRoulette();
    spinTimeout = setTimeout(rotate, 30);
}

function stopRotate() {
    clearTimeout(spinTimeout);
    spinSound.pause();
    spinSound.currentTime = 0;
    const degrees = startAngle * 180 / Math.PI + 90;
    const arcd = arc * 180 / Math.PI;
    const index = Math.floor((360 - degrees % 360) / arcd);
    ctx.save();
    ctx.font = 'bold 30px sans-serif';
    const text = items[index];
    resultText.textContent = text;
    ctx.fillText(text, 250 - ctx.measureText(text).width / 2, 250 + 10);
    ctx.restore();
}

function easeOut(t, b, c, d) {
    const ts = (t /= d) * t;
    const tc = ts * t;
    return b + c * (tc + -3 * ts + 3 * t);
}

function updateRoulette() {
    items = inputTextArea.value.split('\n').filter(item => item.trim() !== '');
    if (items.length > 0) {
        generateColors();
        drawRoulette();
        saveItems();
    }
}

function generateColors() {
    colors = [];
    for (let i = 0; i < items.length; i++) {
        colors.push(`hsl(${i * (360 / items.length)}, 70%, 50%)`);
    }
}

function saveItems() {
    localStorage.setItem('rouletteItems', JSON.stringify(items));
}

function loadItems() {
    const savedItems = localStorage.getItem('rouletteItems');
    if (savedItems) {
        items = JSON.parse(savedItems);
        inputTextArea.value = items.join('\n');
        updateRoulette();
    }
}

spinButton.addEventListener('click', () => {
    spinAngleStart = Math.random() * 10 + 10;
    spinTime = 0;
    spinTimeTotal = Math.random() * 3 + 4 * 1000;
    rotate();
});

updateButton.addEventListener('click', updateRoulette);

removeButton.addEventListener('click', () => {
    const currentResult = resultText.textContent;
    if (currentResult !== '-' && items.includes(currentResult)) {
        items = items.filter(item => item !== currentResult);
        inputTextArea.value = items.join('\n');
        updateRoulette();
    }
});

resetButton.addEventListener('click', () => {
    loadItems();
});

window.addEventListener('load', () => {
    loadItems();
    drawRoulette();
});
