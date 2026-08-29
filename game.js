// Configuración del Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Variables del juego
let gameRunning = false;
let gamePaused = false;
let score = 0;
let lives = 3;
let currentLevel = 1;
let gameObjects = {
    player: null,
    bullets: [],
    enemies: [],
    enemyBullets: []
};

// Controles táctiles
let touchControls = {
    leftPressed: false,
    rightPressed: false,
    autoShoot: true
};

// Configuración de niveles
const levelConfigs = {
    1: { enemyCount: 5, enemySpeed: 2, enemyShootChance: 0.01 },
    2: { enemyCount: 8, enemySpeed: 2.5, enemyShootChance: 0.015 },
    3: { enemyCount: 12, enemySpeed: 3, enemyShootChance: 0.02 },
    4: { enemyCount: 15, enemySpeed: 3.5, enemyShootChance: 0.025 },
    5: { enemyCount: 20, enemySpeed: 4, enemyShootChance: 0.03 }
};

// Sistema de Sonido con síntesis de audio
class SoundManager {
    constructor() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    // Sonido de disparo del jugador
    playShoot() {
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.05);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    }

    // Sonido de explosión (enemigo destruido)
    playExplosion() {
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    // Sonido de daño (jugador golpeado)
    playDamage() {
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    }

    // Sonido de nivel completado
    playLevelUp() {
        const now = this.audioContext.currentTime;
        const notes = [523.25, 659.25, 783.99]; // Do, Mi, Sol
        
        notes.forEach((freq, index) => {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.audioContext.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + index * 0.1);
            gain.gain.setValueAtTime(0.2, now + index * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + index * 0.1 + 0.15);
            osc.start(now + index * 0.1);
            osc.stop(now + index * 0.1 + 0.15);
        });
    }
}

const soundManager = new SoundManager();

// Clase Nave del Jugador (Forma de Avión)
class Player {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 60;
        this.speed = 5;
        this.isMovingLeft = false;
        this.isMovingRight = false;
        this.canShoot = true;
        this.shootCooldown = 300; // ms
    }

    update() {
        if (this.isMovingLeft && this.x > 0) {
            this.x -= this.speed;
        }
        if (this.isMovingRight && this.x + this.width < canvas.width) {
            this.x += this.speed;
        }
    }

    draw() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        
        // Dibujar avión (forma estilizada)
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        
        // Fuselaje principal (cuerpo del avión)
        ctx.moveTo(0, -15);      // Punta frontal
        ctx.lineTo(8, -5);       // Derecha punta
        ctx.lineTo(10, 5);       // Ala derecha
        ctx.lineTo(8, 15);       // Cola derecha
        ctx.lineTo(-8, 15);      // Cola izquierda
        ctx.lineTo(-10, 5);      // Ala izquierda
        ctx.lineTo(-8, -5);      // Izquierda punta
        ctx.closePath();
        ctx.fill();

        // Alas más definidas
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-15, 3);
        ctx.moveTo(10, 0);
        ctx.lineTo(15, 3);
        ctx.stroke();

        // Brillo/destello
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(0, -8, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    shoot() {
        if (this.canShoot) {
            const bullet = new Bullet(this.x + this.width / 2 - 2, this.y, true);
            gameObjects.bullets.push(bullet);
            soundManager.playShoot();
            this.canShoot = false;
            setTimeout(() => {
                this.canShoot = true;
            }, this.shootCooldown);
        }
    }

    getCollisionBox() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Clase Bala
class Bullet {
    constructor(x, y, isPlayerBullet) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = 7;
        this.isPlayerBullet = isPlayerBullet;
    }

    update() {
        if (this.isPlayerBullet) {
            this.y -= this.speed;
        } else {
            this.y += this.speed;
        }
    }

    draw() {
        ctx.fillStyle = this.isPlayerBullet ? '#00ff00' : '#ff0000';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        if (this.isPlayerBullet) {
            ctx.strokeStyle = '#00ff00';
        } else {
            ctx.strokeStyle = '#ff0000';
        }
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    isOutOfBounds() {
        return this.y < 0 || this.y > canvas.height;
    }

    getCollisionBox() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Clase Enemigo (Forma de Avión Rojo)
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 35;
        this.height = 35;
        this.speed = levelConfigs[currentLevel].enemySpeed;
        this.shootChance = levelConfigs[currentLevel].enemyShootChance;
        this.shootCooldown = 0;
        this.direction = Math.random() > 0.5 ? 1 : -1;
    }

    update() {
        this.x += this.speed * this.direction;

        // Rebotar en los bordes
        if (this.x <= 0 || this.x + this.width >= canvas.width) {
            this.direction *= -1;
            this.y += 30;
        }

        // Limitar en pantalla verticalmente
        if (this.y > canvas.height) {
            this.y = canvas.height;
        }

        // Intenta disparar
        this.shootCooldown--;
        if (Math.random() < this.shootChance && this.shootCooldown <= 0) {
            this.shoot();
            this.shootCooldown = 30;
        }
    }

    draw() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.save();
        ctx.translate(centerX, centerY);

        // Dibujar avión enemigo (rojo, apuntando hacia abajo)
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        
        // Fuselaje
        ctx.moveTo(0, 15);       // Punta frontal (abajo)
        ctx.lineTo(8, 5);        // Derecha punta
        ctx.lineTo(10, -5);      // Ala derecha
        ctx.lineTo(8, -15);      // Cola derecha
        ctx.lineTo(-8, -15);     // Cola izquierda
        ctx.lineTo(-10, -5);     // Ala izquierda
        ctx.lineTo(-8, 5);       // Izquierda punta
        ctx.closePath();
        ctx.fill();

        // Alas
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(-15, -3);
        ctx.moveTo(10, 0);
        ctx.lineTo(15, -3);
        ctx.stroke();

        // Ojos enemigos (como indicador de IA)
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(-4, 0, 2, 0, Math.PI * 2);
        ctx.arc(4, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    shoot() {
        const bullet = new Bullet(this.x + this.width / 2 - 2, this.y + this.height, false);
        gameObjects.enemyBullets.push(bullet);
    }

    getCollisionBox() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Sistema de Colisiones
function checkCollision(box1, box2) {
    return box1.x < box2.x + box2.width &&
           box1.x + box1.width > box2.x &&
           box1.y < box2.y + box2.height &&
           box1.y + box1.height > box2.y;
}

function checkCollisions() {
    // Balas del jugador vs Enemigos
    for (let i = gameObjects.bullets.length - 1; i >= 0; i--) {
        const bullet = gameObjects.bullets[i];
        for (let j = gameObjects.enemies.length - 1; j >= 0; j--) {
            const enemy = gameObjects.enemies[j];
            if (checkCollision(bullet.getCollisionBox(), enemy.getCollisionBox())) {
                gameObjects.bullets.splice(i, 1);
                gameObjects.enemies.splice(j, 1);
                score += 100;
                updateScore();
                soundManager.playExplosion();
                break;
            }
        }
    }

    // Balas enemigas vs Jugador
    for (let i = gameObjects.enemyBullets.length - 1; i >= 0; i--) {
        const bullet = gameObjects.enemyBullets[i];
        if (checkCollision(bullet.getCollisionBox(), gameObjects.player.getCollisionBox())) {
            gameObjects.enemyBullets.splice(i, 1);
            lives--;
            updateLives();
            soundManager.playDamage();
            if (lives <= 0) {
                endGame(false);
            }
        }
    }

    // Enemigos vs Jugador (Colisión directa)
    for (let enemy of gameObjects.enemies) {
        if (checkCollision(enemy.getCollisionBox(), gameObjects.player.getCollisionBox())) {
            lives--;
            updateLives();
            soundManager.playDamage();
            // Eliminar el enemigo
            gameObjects.enemies.splice(gameObjects.enemies.indexOf(enemy), 1);
            if (lives <= 0) {
                endGame(false);
            }
        }
    }
}

// Funciones de actualización de UI
function updateScore() {
    document.getElementById('score').textContent = score;
}

function updateLives() {
    document.getElementById('lives').textContent = lives;
}

function updateEnemiesCount() {
    document.getElementById('enemies-count').textContent = gameObjects.enemies.length;
}

function updateLevel() {
    document.getElementById('level').textContent = currentLevel;
}

// Inicializar nivel
function initializeLevel() {
    gameObjects.bullets = [];
    gameObjects.enemies = [];
    gameObjects.enemyBullets = [];

    const config = levelConfigs[currentLevel];
    if (config) {
        for (let i = 0; i < config.enemyCount; i++) {
            const x = (i % 5) * 150 + 50;
            const y = Math.floor(i / 5) * 80 + 30;
            gameObjects.enemies.push(new Enemy(x, y));
        }
    }

    updateLevel();
    updateEnemiesCount();
}

// Bucle principal del juego
function gameLoop() {
    // Limpiar canvas
    ctx.fillStyle = 'rgba(10, 14, 39, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!gamePaused && gameRunning) {
        // Actualizar jugador
        gameObjects.player.update();

        // Auto disparo en móvil
        if (touchControls.autoShoot) {
            gameObjects.player.shoot();
        }

        // Actualizar balas del jugador
        for (let i = gameObjects.bullets.length - 1; i >= 0; i--) {
            gameObjects.bullets[i].update();
            if (gameObjects.bullets[i].isOutOfBounds()) {
                gameObjects.bullets.splice(i, 1);
            }
        }

        // Actualizar enemigos
        for (let enemy of gameObjects.enemies) {
            enemy.update();
        }

        // Actualizar balas enemigas
        for (let i = gameObjects.enemyBullets.length - 1; i >= 0; i--) {
            gameObjects.enemyBullets[i].update();
            if (gameObjects.enemyBullets[i].isOutOfBounds()) {
                gameObjects.enemyBullets.splice(i, 1);
            }
        }

        // Verificar colisiones
        checkCollisions();
        updateEnemiesCount();

        // Verificar si ganó el nivel
        if (gameObjects.enemies.length === 0) {
            levelUp();
        }
    }

    // Dibujar objetos
    gameObjects.player.draw();

    for (let bullet of gameObjects.bullets) {
        bullet.draw();
    }

    for (let enemy of gameObjects.enemies) {
        enemy.draw();
    }

    for (let bullet of gameObjects.enemyBullets) {
        bullet.draw();
    }

    // Dibujar efecto de mira
    if (gameRunning && !gamePaused) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(gameObjects.player.x + gameObjects.player.width / 2, gameObjects.player.y + gameObjects.player.height / 2, 30, 0, Math.PI * 2);
        ctx.stroke();
    }

    requestAnimationFrame(gameLoop);
}

// ===== CONTROLES: Teclado =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        gameObjects.player.isMovingLeft = true;
    }
    if (e.key === 'ArrowRight') {
        gameObjects.player.isMovingRight = true;
    }
    if (e.key === ' ') {
        e.preventDefault();
        if (gameRunning && !gamePaused) {
            gameObjects.player.shoot();
        }
    }
    if (e.key === 'p' || e.key === 'P') {
        if (gameRunning) {
            togglePause();
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') {
        gameObjects.player.isMovingLeft = false;
    }
    if (e.key === 'ArrowRight') {
        gameObjects.player.isMovingRight = false;
    }
});

// ===== CONTROLES: Táctil (Teléfono) =====
canvas.addEventListener('touchstart', (e) => {
    const touches = e.touches;
    for (let touch of touches) {
        const rect = canvas.getBoundingClientRect();
        const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
        
        // Dividir pantalla en zonas
        if (touchX < canvas.width / 3) {
            gameObjects.player.isMovingLeft = true;
        } else if (touchX > (canvas.width * 2) / 3) {
            gameObjects.player.isMovingRight = true;
        }
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    gameObjects.player.isMovingLeft = false;
    gameObjects.player.isMovingRight = false;
    
    const touches = e.touches;
    for (let touch of touches) {
        const rect = canvas.getBoundingClientRect();
        const touchX = (touch.clientX - rect.left) * (canvas.width / rect.width);
        
        if (touchX < canvas.width / 3) {
            gameObjects.player.isMovingLeft = true;
        } else if (touchX > (canvas.width * 2) / 3) {
            gameObjects.player.isMovingRight = true;
        }
    }
});

canvas.addEventListener('touchend', () => {
    gameObjects.player.isMovingLeft = false;
    gameObjects.player.isMovingRight = false;
});

// Controles para mouse (escritorio)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    
    gameObjects.player.isMovingLeft = false;
    gameObjects.player.isMovingRight = false;
    
    if (mouseX < canvas.width / 3) {
        gameObjects.player.isMovingLeft = true;
    } else if (mouseX > (canvas.width * 2) / 3) {
        gameObjects.player.isMovingRight = true;
    }
});

canvas.addEventListener('mouseleave', () => {
    gameObjects.player.isMovingLeft = false;
    gameObjects.player.isMovingRight = false;
});

// Funciones del juego
function startGame() {
    document.getElementById('startScreen').classList.add('hidden');
    gameRunning = true;
    gamePaused = false;
    gameObjects.player = new Player();
    initializeLevel();
    gameLoop();
}

function togglePause() {
    gamePaused = !gamePaused;
    if (gamePaused) {
        document.getElementById('pauseScreen').classList.remove('hidden');
    } else {
        document.getElementById('pauseScreen').classList.add('hidden');
    }
}

function levelUp() {
    gameRunning = false;
    soundManager.playLevelUp();
    const levelMessage = document.getElementById('levelMessage');
    levelMessage.textContent = `¡Completaste el nivel ${currentLevel}! Puntuación: ${score}`;
    document.getElementById('levelUp').classList.remove('hidden');
}

function nextLevel() {
    if (currentLevel < 5) {
        currentLevel++;
        document.getElementById('levelUp').classList.add('hidden');
        gameRunning = true;
        gamePaused = false;
        initializeLevel();
    } else {
        document.getElementById('levelUp').classList.add('hidden');
        endGame(true);
    }
}

function endGame(won) {
    gameRunning = false;
    const gameOverMsg = document.getElementById('gameOverMessage');
    if (won) {
        gameOverMsg.textContent = '🎉 ¡GANASTE! Completaste todos los niveles';
    } else {
        gameOverMsg.textContent = '💥 GAME OVER - Sin vidas restantes';
    }
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').classList.remove('hidden');
}

// Inicializar el juego
window.onload = () => {
    document.getElementById('startScreen').classList.remove('hidden');
};
