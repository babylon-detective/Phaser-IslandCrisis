// Constants for menu
const MENU_TEXT_SIZE = '48px';
const MENU_SELECTED_COLOR = '#ffffff';
const MENU_UNSELECTED_COLOR = '#808080';
const MENU_FONT = 'Arial Black, sans-serif';
const OVERLAY_OPACITY = 0.5;

// Game constants
const GROUND_HEIGHT = 100;
const GAP_WIDTH = 200;
const GAP_SPACING = 500;

// Lava constants
const LAVA_FLOAT_SPEED = 1.5;
const LAVA_FLOAT_AMPLITUDE = 10;
const BLINK_TIMES = 3;
const BLINK_INTERVAL = 200;

// Tree constants
const MIN_TREE_HEIGHT = 100;
const MAX_TREE_HEIGHT = 400;
const TREE_WIDTH = 20;
const BRANCH_LENGTH = 80;
const BRANCH_HEIGHT = 10;
const MIN_BRANCHES = 1;
const MAX_BRANCHES = 3;
const TREE_CHANCE = 0.7; // 70% chance to spawn a tree on each valid position

// Player constants
const PLAYER_WIDTH = 30;
const PLAYER_HEIGHT = 60;
const PLAYER_SPEED = 200;
const PLAYER_JUMP_SPEED = -400;
const PLAYER_CROUCH_HEIGHT = 30;
const PLAYER_DASH_SPEED = 400;
const PLAYER_DASH_DURATION = 200;
const PLAYER_DASH_COOLDOWN = 1000;
const PLAYER_SLIDE_SPEED = 500;
const PLAYER_SLIDE_DURATION = 500;
const PLAYER_SLIDE_FRICTION = 0.95;

// Checkpoint constants
const BASE_CHECKPOINT_DISTANCE = 100; // 100m for first level
const CHECKPOINT_RADIUS = 30;
const CHECKPOINT_HEIGHT = 150; // Height above ground
const CHECKPOINT_GLOW_LAYERS = 5;

// Lives constants
const MAX_LIVES = 3;
const LIFE_CIRCLE_RADIUS = 10;
const LIFE_CIRCLE_SPACING = 25;

// Victory effect constants
const VICTORY_DURATION = 5000; // 5 seconds for victory animation
const VICTORY_GLOW_LAYERS = 5;
const VICTORY_GLOW_COLOR = 0xffd700; // Gold color
const FADE_DURATION = 2000; // 2 seconds for fade to black

// Death line constants
const DEATH_LINE_Y_OFFSET = 50; // Distance below lowest lava point
const DEATH_LINE_COLOR = 0xff0000;
const DEATH_LINE_THICKNESS = 2;
const DEATH_LINE_ALPHA = 0.8;
const SIGNAL_WAVE_SPEED = 2;
const SIGNAL_WAVE_AMPLITUDE = 0.2;

// Death text constants
const DEATH_TEXT_DURATION = 2000;
const DEATH_TEXT_FLASH_COUNT = 4;
const DEATH_TEXT_SIZE = '150px';
const DEATH_TEXT_COLOR = '#ff0000';
const DEATH_TEXT_STROKE = '#660000';
const DEATH_TEXT_STROKE_THICKNESS = 16;
// Game over text constants
const GAME_OVER_COLOR = '#808080';
const GAME_OVER_STROKE = '#404040';
const WAVE_AMPLITUDE = 30;
const WAVE_FREQUENCY = 2;

// Game state variables
let platforms;
let branches;
let lavaGroup;
let player;
let playerGraphics;
let cursors;
let isPlayerDead = false;
let blinkCount = 0;

// Game state
let currentDistance = 0;
let recordDistance = 0;
let currentLevel = 1;
let currentLives = 3;
let distanceText;
let recordText;
let levelText;
let livesContainer;
let checkpoint;
let checkpointGlow;
let victoryText;
let deathText;
let isLevelTransitioning = false;
let canDash = true;
let isDashing = false;
let isSliding = false;
let dashTimer = null;
let slideTimer = null;
let currentSlideSpeed = 0;
let deathLine;

// Add these functions at the top level
function saveGameState() {
    const gameState = {
        currentLevel: currentLevel,
        currentDistance: currentDistance,
        recordDistance: recordDistance,
        currentLives: currentLives,
        lastCheckpointX: player ? player.x : 100
    };
    localStorage.setItem('islandCrisisGameState', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('islandCrisisGameState');
    if (savedState) {
        return JSON.parse(savedState);
    }
    return null;
}

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
    }

    preload() {
        // Generate ground texture with stripes
        const groundTexture = this.add.graphics();
        groundTexture.fillStyle(0x808080); // Gray
        groundTexture.fillRect(0, 0, 100, GROUND_HEIGHT);
        
        // Add dark green stripes
        groundTexture.lineStyle(3, 0x006400);
        for(let i = 0; i < GROUND_HEIGHT; i += 10) {
            groundTexture.lineBetween(0, i, 100, i);
        }
        
        groundTexture.generateTexture('ground', 100, GROUND_HEIGHT);
        groundTexture.destroy();
    }

    create() {
        // Add pause key
        this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.pauseKey.on('down', () => this.togglePause());
        
        // Create pause menu (hidden by default)
        this.createPauseMenu();
        
        platforms = this.physics.add.staticGroup();
        branches = this.physics.add.staticGroup();
        lavaGroup = new Set();
        
        // Create initial terrain segments
        for(let x = 0; x < window.innerWidth + 1000; x += GAP_SPACING) {
            const segment = this.createTerrainSegment(x);
        }
        
        // Create death line
        deathLine = this.createDeathLine();
        
        // Create UI elements
        this.createUIElements();
        this.createLivesDisplay();
        
        // Create player graphics object with higher depth
        playerGraphics = this.add.graphics();
        playerGraphics.setDepth(1);
        
        // Create invisible physics sprite for player
        player = this.physics.add.sprite(
            100,
            window.innerHeight - GROUND_HEIGHT - PLAYER_HEIGHT,
            null
        );
        
        // Set up player physics
        player.setSize(PLAYER_WIDTH, PLAYER_HEIGHT);
        player.setBounce(0.1);
        player.setCollideWorldBounds(false);
        player.setVisible(false);
        
        // Enable collision between player and platforms/branches
        this.physics.add.collider(player, platforms);
        this.physics.add.collider(player, branches);
        
        // Create initial checkpoint
        this.updateCheckpoint();
        
        // Set up keyboard controls
        cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
        });
        
        // Set up camera
        this.cameras.main.startFollow(player, true, 0.08, 0.08);
        this.cameras.main.setDeadzone(100, 100);
        
        // Add lava collision
        lavaGroup.forEach(lava => {
            this.physics.add.overlap(player, lava.collider, this.playerDeath, null, this);
        });

        // Add autosave timer
        this.time.addEvent({
            delay: 5000, // Save every 5 seconds
            callback: saveGameState,
            callbackScope: this,
            loop: true
        });
    }

    update() {
        if (isPlayerDead || this.scene.isPaused()) return;
        
        // Update death line
        this.updateDeathLine();
        this.checkDeathLineCollision();
        
        // Update distance based on player position
        currentDistance = Math.max(0, player.x - 100) / 50;
        
        // Handle movement
        if (!isDashing && !isSliding) {
            if (cursors.left.isDown) {
                if (cursors.shift.isDown && canDash) {
                    this.startDash(-1);
                } else {
                    player.setVelocityX(-PLAYER_SPEED);
                }
            } else if (cursors.right.isDown) {
                if (cursors.shift.isDown && canDash) {
                    this.startDash(1);
                } else {
                    player.setVelocityX(PLAYER_SPEED);
                }
            } else {
                player.setVelocityX(0);
            }
        }
        
        // Handle sliding
        if (cursors.down.isDown && cursors.shift.isDown && player.body.touching.down && !isSliding) {
            this.startSlide(player.body.velocity.x > 0 ? 1 : -1);
        }
        
        // Apply slide physics
        if (isSliding) {
            currentSlideSpeed *= PLAYER_SLIDE_FRICTION;
            player.setVelocityX(currentSlideSpeed);
        }
        
        // Handle jumping
        if (cursors.up.isDown && player.body.touching.down && !isSliding) {
            player.setVelocityY(PLAYER_JUMP_SPEED);
        }
        
        // Handle crouching
        if (cursors.down.isDown && player.body.touching.down && !isSliding) {
            if (player.height !== PLAYER_CROUCH_HEIGHT) {
                player.setSize(PLAYER_WIDTH, PLAYER_CROUCH_HEIGHT, true);
            }
        } else if (!isSliding) {
            if (player.height !== PLAYER_HEIGHT) {
                player.setSize(PLAYER_WIDTH, PLAYER_HEIGHT, true);
            }
        }
        
        // Draw player
        playerGraphics.clear();
        playerGraphics.fillStyle(0x00ff00);
        playerGraphics.fillRect(
            player.x - PLAYER_WIDTH/2,
            player.y - player.height/2,
            PLAYER_WIDTH,
            player.height
        );
        
        // Animate checkpoint glow
        if (checkpoint) {
            const time = this.time.now / 1000;
            checkpoint.group.getChildren().forEach((circle, index) => {
                const pulseScale = 1 + Math.sin(time * 2) * 0.1;
                circle.setScale(pulseScale);
            });
        }
        
        this.updateUI();
        
        // Infinite scrolling
        const camX = this.cameras.main.scrollX;
        platforms.children.iterate(child => {
            if(child.x < camX - child.width) {
                // Calculate new position
                const groundWidth = GAP_SPACING - GAP_WIDTH;
                const newX = child.x + (GAP_SPACING * Math.ceil(platforms.children.size/2));
                
                // Reset the ground segment completely
                child.destroy();
                const newGround = platforms.create(newX + groundWidth/2, window.innerHeight - GROUND_HEIGHT/2, 'ground');
                newGround.setDisplaySize(groundWidth, GROUND_HEIGHT);
                
                // Set up collision body with correct properties
                const collisionHeight = 20;
                newGround.body.setSize(groundWidth, collisionHeight);
                newGround.body.setOffset(-groundWidth/3, (GROUND_HEIGHT - collisionHeight)/2);
                newGround.body.immovable = true;
                newGround.body.allowGravity = false;

                // Add new trees for this segment
                const groundY = window.innerHeight - GROUND_HEIGHT/2;
                const treesPerSegment = Math.floor(groundWidth / 100);
                for (let i = 0; i < treesPerSegment; i++) {
                    if (Math.random() < TREE_CHANCE) {
                        const treeX = newX + (i * 100) + Phaser.Math.Between(50, 80);
                        this.createTree(treeX, groundY - GROUND_HEIGHT/2);
                    }
                }
                
                // Create new lava for recycled segment
                const newLava = this.createLava(newX + groundWidth, GAP_WIDTH);
                lavaGroup.add(newLava);
            }
        });
        
        // Clean up and update lava
        lavaGroup.forEach(lava => {
            if (lava.group.getChildren()[0].x < camX - GAP_SPACING) {
                lava.group.destroy(true);
                lava.collider.destroy();
                lavaGroup.delete(lava);
            } else {
                // Animate lava
                lava.time += 0.05;
                const color = Phaser.Display.Color.Interpolate.ColorWithColor(
                    new Phaser.Display.Color(255, 0, 0),
                    new Phaser.Display.Color(255, 255, 0),
                    100,
                    Math.abs(Math.sin(lava.time)) * 100
                );
                
                const yOffset = Math.sin(lava.time * LAVA_FLOAT_SPEED) * LAVA_FLOAT_AMPLITUDE;
                
                lava.group.getChildren().forEach(child => {
                    child.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));
                    child.y = lava.baseY + yOffset;
                });
                lava.collider.y = lava.baseY + yOffset;
            }
        });
        
        // Clean up off-screen branches safely
        const branchesToDestroy = [];
        branches.children.iterate(branch => {
            if (branch && branch.x < camX - GAP_SPACING) {
                branchesToDestroy.push(branch);
            }
        });
        branchesToDestroy.forEach(branch => branch.destroy());

        // Check for checkpoint collision
        if (checkpoint && !isLevelTransitioning) {
            const playerBounds = player.getBounds();
            const checkpointBounds = new Phaser.Geom.Circle(
                checkpoint.detectionZone.x,
                checkpoint.detectionZone.y,
                CHECKPOINT_RADIUS
            );
            
            if (Phaser.Geom.Intersects.CircleToRectangle(checkpointBounds, playerBounds)) {
                isLevelTransitioning = true;
                this.showVictoryEffect();
            }
        }

        // Save game state after significant progress
        if (Math.floor(currentDistance) % 100 === 0) { // Save every 100 meters
            saveGameState();
        }
    }

    createPauseMenu() {
        // Create overlay
        this.pauseOverlay = document.createElement('div');
        this.pauseOverlay.style.position = 'fixed';
        this.pauseOverlay.style.top = '0';
        this.pauseOverlay.style.left = '0';
        this.pauseOverlay.style.width = '100%';
        this.pauseOverlay.style.height = '100%';
        this.pauseOverlay.style.backgroundColor = `rgba(0, 0, 0, ${OVERLAY_OPACITY})`;
        this.pauseOverlay.style.display = 'none';
        this.pauseOverlay.style.zIndex = '2000';
        this.pauseOverlay.style.alignItems = 'center';
        this.pauseOverlay.style.justifyContent = 'center';
        this.pauseOverlay.style.flexDirection = 'column';
        
        // Create menu container
        this.pauseMenu = document.createElement('div');
        this.pauseMenu.style.display = 'flex';
        this.pauseMenu.style.flexDirection = 'column';
        this.pauseMenu.style.alignItems = 'center';
        this.pauseMenu.style.gap = '20px';
        
        // Create menu options
        this.continueOption = document.createElement('div');
        this.continueOption.textContent = 'CONTINUE';
        this.continueOption.style.fontSize = MENU_TEXT_SIZE;
        this.continueOption.style.fontFamily = MENU_FONT;
        this.continueOption.style.cursor = 'pointer';
        
        this.exitOption = document.createElement('div');
        this.exitOption.textContent = 'EXIT';
        this.exitOption.style.fontSize = MENU_TEXT_SIZE;
        this.exitOption.style.fontFamily = MENU_FONT;
        this.exitOption.style.cursor = 'pointer';
        
        this.pauseMenu.appendChild(this.continueOption);
        this.pauseMenu.appendChild(this.exitOption);
        this.pauseOverlay.appendChild(this.pauseMenu);
        
        document.getElementById('game').appendChild(this.pauseOverlay);
        
        this.selectedOption = 0; // 0 for continue, 1 for exit
        this.updatePauseMenuSelection();
    }

    togglePause() {
        if (this.scene.isPaused()) {
            this.resumeGame();
        } else {
            this.pauseGame();
        }
    }

    pauseGame() {
        this.scene.pause();
        this.pauseOverlay.style.display = 'flex';
        this.selectedOption = 0;
        this.updatePauseMenuSelection();
        
        // Add keyboard listeners for menu navigation
        this.pauseKeyHandler = (event) => {
            if (event.key === 'w' || event.key === 'W') {
                this.selectedOption = Math.max(0, this.selectedOption - 1);
                this.updatePauseMenuSelection();
            } else if (event.key === 's' || event.key === 'S') {
                this.selectedOption = Math.min(1, this.selectedOption + 1);
                this.updatePauseMenuSelection();
            } else if (event.key === 'Enter') {
                if (this.selectedOption === 0) {
                    this.resumeGame();
                } else {
                    this.exitToTitle();
                }
            } else if (event.key === 'p' || event.key === 'P') {
                this.resumeGame();
            }
        };
        
        document.addEventListener('keydown', this.pauseKeyHandler);
    }

    resumeGame() {
        this.scene.resume();
        this.pauseOverlay.style.display = 'none';
        document.removeEventListener('keydown', this.pauseKeyHandler);
    }

    exitToTitle() {
        this.pauseOverlay.style.display = 'none';
        document.removeEventListener('keydown', this.pauseKeyHandler);
        this.scene.start('TitleScene');
    }

    updatePauseMenuSelection() {
        this.continueOption.style.color = this.selectedOption === 0 ? MENU_SELECTED_COLOR : MENU_UNSELECTED_COLOR;
        this.exitOption.style.color = this.selectedOption === 1 ? MENU_SELECTED_COLOR : MENU_UNSELECTED_COLOR;
    }

    createTree(x, groundY) {
        // Random tree height
        const treeHeight = Phaser.Math.Between(MIN_TREE_HEIGHT, MAX_TREE_HEIGHT);
        
        // Create tree trunk (visual only, no collision)
        const trunk = this.add.rectangle(
            x,
            groundY - treeHeight/2,
            TREE_WIDTH,
            treeHeight,
            0x4a2800 // Brown color
        );
        
        // Random number of branches
        const numBranches = Phaser.Math.Between(MIN_BRANCHES, MAX_BRANCHES);
        
        // Create branches at random heights
        for (let i = 0; i < numBranches; i++) {
            const branchY = groundY - Phaser.Math.Between(treeHeight * 0.3, treeHeight * 0.9);
            // Randomly choose left or right side
            const direction = Math.random() < 0.5 ? -1 : 1;
            const branchX = x + (direction * BRANCH_LENGTH/2);
            
            // Create visual branch
            const branchVisual = this.add.rectangle(
                branchX,
                branchY,
                BRANCH_LENGTH,
                BRANCH_HEIGHT,
                0x355e3b // Dark green color
            );
            
            // Create branch collision body
            const branch = branches.create(branchX, branchY, null);
            branch.setSize(BRANCH_LENGTH, BRANCH_HEIGHT, true); // true to center the body
            branch.body.setOffset(-BRANCH_LENGTH/2, -BRANCH_HEIGHT/2); // Center the collision body
            branch.refreshBody();
            branch.body.checkCollision.down = false;
            branch.body.checkCollision.left = false;
            branch.body.checkCollision.right = false;
            branch.visible = false;
        }
    }

    createLava(x, width) {
        const groundY = window.innerHeight - GROUND_HEIGHT/2;
        const lavaX = x + width/2;
        
        // Create glow effect layers
        const glowLayers = 5;
        const lavaContainer = this.add.group();
        
        for (let i = glowLayers; i > 0; i--) {
            const size = width + (i * 20);
            const alpha = 0.2 - (i * 0.03);
            const lava = this.add.rectangle(
                lavaX,
                groundY,
                size,
                GROUND_HEIGHT + (i * 10),
                0xff0000
            );
            lava.setAlpha(alpha);
            lavaContainer.add(lava);
        }
        
        // Add main lava rectangle with collision
        const mainLava = this.add.rectangle(
            lavaX,
            groundY,
            width,
            GROUND_HEIGHT,
            0xff0000
        );
        lavaContainer.add(mainLava);
        
        // Add collision body for lava using sprite instead of rectangle
        const lavaCollider = this.physics.add.sprite(lavaX, groundY);
        lavaCollider.setSize(width * 0.9, GROUND_HEIGHT * 0.9);
        lavaCollider.setImmovable(true);
        lavaCollider.body.allowGravity = false;
        lavaCollider.visible = false;
        
        return {
            group: lavaContainer,
            collider: lavaCollider,
            time: 0,
            baseY: groundY
        };
    }

    createUIElements() {
        // Create distance counter
        const distanceDiv = document.createElement('div');
        distanceDiv.style.position = 'absolute';
        distanceDiv.style.top = '20px';
        distanceDiv.style.left = '50%';
        distanceDiv.style.transform = 'translateX(-50%)';
        distanceDiv.style.color = 'white';
        distanceDiv.style.fontSize = '24px';
        distanceDiv.style.fontFamily = 'Arial, sans-serif';
        distanceDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        document.getElementById('game').appendChild(distanceDiv);
        distanceText = distanceDiv;

        // Create record display
        const recordDiv = document.createElement('div');
        recordDiv.style.position = 'absolute';
        recordDiv.style.top = '20px';
        recordDiv.style.right = '20px';
        recordDiv.style.color = 'gold';
        recordDiv.style.fontSize = '20px';
        recordDiv.style.fontFamily = 'Arial, sans-serif';
        recordDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        document.getElementById('game').appendChild(recordDiv);
        recordText = recordDiv;

        // Create level display
        const levelDiv = document.createElement('div');
        levelDiv.style.position = 'absolute';
        levelDiv.style.top = '20px';
        levelDiv.style.left = '20px';
        levelDiv.style.color = 'white';
        levelDiv.style.fontSize = '20px';
        levelDiv.style.fontFamily = 'Arial, sans-serif';
        levelDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        document.getElementById('game').appendChild(levelDiv);
        levelText = levelDiv;

        this.updateUI();
    }

    updateUI() {
        if (distanceText) {
            distanceText.textContent = `Distance: ${Math.floor(currentDistance)}m`;
        }
        if (recordText) {
            if (recordDistance > 0) {
                recordText.textContent = `Record: ${Math.floor(recordDistance)}m`;
                recordText.style.right = '20px'; // Ensure record text is at the far right
            } else {
                recordText.textContent = '';
            }
        }
        if (levelText) {
            levelText.textContent = `Level: ${currentLevel} (${this.getCheckpointDistance()}m to go)`;
        }
    }

    createTerrainSegment(x) {
        const groundY = window.innerHeight - GROUND_HEIGHT/2;
        const groundWidth = GAP_SPACING - GAP_WIDTH;
        
        // Create ground segment
        const ground = platforms.create(x + groundWidth/2, groundY, 'ground');
        ground.setDisplaySize(groundWidth, GROUND_HEIGHT);
        
        // Set up collision body
        const collisionHeight = 20;
        ground.body.setSize(groundWidth, collisionHeight);
        ground.body.setOffset(-groundWidth/3, (GROUND_HEIGHT - collisionHeight)/2);
        ground.body.immovable = true;
        ground.body.allowGravity = false;
        
        // Create lava in gap
        const lava = this.createLava(x + groundWidth, GAP_WIDTH);
        lavaGroup.add(lava);
        
        // Add random trees along the ground segment
        const treesPerSegment = Math.floor(groundWidth / 100);
        for (let i = 0; i < treesPerSegment; i++) {
            if (Math.random() < TREE_CHANCE) {
                const treeX = x + (i * 100) + Phaser.Math.Between(50, 80);
                this.createTree(treeX, groundY - GROUND_HEIGHT/2);
            }
        }
        
        return { ground: ground, lava: lava };
    }

    getCheckpointDistance() {
        return BASE_CHECKPOINT_DISTANCE * currentLevel;
    }

    createCheckpoint(scene, x, y) {
        const checkpointGroup = scene.add.group();
        
        // Create glow layers
        for (let i = CHECKPOINT_GLOW_LAYERS; i > 0; i--) {
            const size = CHECKPOINT_RADIUS * 2 + (i * 10);
            const alpha = 0.2 - (i * 0.03);
            const glow = scene.add.circle(x, y, size/2, 0x00ff00);
            glow.setAlpha(alpha);
            checkpointGroup.add(glow);
        }
        
        // Create main checkpoint circle
        const mainCircle = scene.add.circle(x, y, CHECKPOINT_RADIUS, 0x00ff00);
        checkpointGroup.add(mainCircle);
        
        // Create overlap detection zone (no physics body)
        const detectionZone = scene.add.circle(x, y, CHECKPOINT_RADIUS);
        detectionZone.setData('isCheckpoint', true);
        
        return { group: checkpointGroup, detectionZone: detectionZone };
    }

    updateCheckpoint() {
        if (checkpoint) {
            checkpoint.group.destroy(true);
            if (checkpoint.detectionZone) {
                checkpoint.detectionZone.destroy();
            }
        }
        
        const checkpointX = (this.getCheckpointDistance() * 50) + 100;
        const checkpointY = window.innerHeight - GROUND_HEIGHT - CHECKPOINT_HEIGHT;
        
        checkpoint = this.createCheckpoint(this, checkpointX, checkpointY);
    }

    createLivesDisplay() {
        // Create container for lives
        const livesDiv = document.createElement('div');
        livesDiv.style.position = 'absolute';
        livesDiv.style.top = '20px';
        livesDiv.style.right = '150px'; // Position before the record text
        livesDiv.style.display = 'flex';
        livesDiv.style.gap = '5px';
        document.getElementById('game').appendChild(livesDiv);
        livesContainer = livesDiv;
        
        this.updateLivesDisplay();
    }

    updateLivesDisplay() {
        if (!livesContainer) return;
        
        // Clear existing lives
        livesContainer.innerHTML = '';
        
        // Create circles for each life
        for (let i = 0; i < MAX_LIVES; i++) {
            const lifeCircle = document.createElement('div');
            lifeCircle.style.width = `${LIFE_CIRCLE_RADIUS * 2}px`;
            lifeCircle.style.height = `${LIFE_CIRCLE_RADIUS * 2}px`;
            lifeCircle.style.borderRadius = '50%';
            lifeCircle.style.backgroundColor = i < currentLives ? '#00ff00' : '#333333';
            lifeCircle.style.border = '2px solid #ffffff';
            livesContainer.appendChild(lifeCircle);
        }
    }

    createDeathText() {
        // Create container for death text
        const textContainer = document.createElement('div');
        textContainer.style.position = 'fixed';
        textContainer.style.top = '50%';
        textContainer.style.left = '50%';
        textContainer.style.transform = 'translate(-50%, -50%)';
        textContainer.style.zIndex = '1000';
        textContainer.style.pointerEvents = 'none';
        
        const isGameOver = currentLives <= 1;
        const message = isGameOver ? "IT'S OVER" : "YOU DIED!";
        const textColor = isGameOver ? GAME_OVER_COLOR : DEATH_TEXT_COLOR;
        const strokeColor = isGameOver ? GAME_OVER_STROKE : DEATH_TEXT_STROKE;
        
        // Create shadow layers
        for (let i = 3; i > 0; i--) {
            const shadowText = document.createElement('div');
            shadowText.textContent = message;
            shadowText.style.position = 'absolute';
            shadowText.style.left = '50%';
            shadowText.style.top = '50%';
            shadowText.style.transform = 'translate(-50%, -50%)';
            shadowText.style.fontSize = DEATH_TEXT_SIZE;
            shadowText.style.fontFamily = 'Arial Black, sans-serif';
            shadowText.style.color = textColor;
            shadowText.style.textShadow = `${DEATH_TEXT_STROKE_THICKNESS + i * 2}px ${DEATH_TEXT_STROKE_THICKNESS + i * 2}px ${strokeColor}`;
            shadowText.style.opacity = 0.3 - (i * 0.1);
            shadowText.style.whiteSpace = 'nowrap';
            textContainer.appendChild(shadowText);
        }
        
        // Create main text
        const mainText = document.createElement('div');
        mainText.textContent = message;
        mainText.style.position = 'absolute';
        mainText.style.left = '50%';
        mainText.style.top = '50%';
        mainText.style.transform = 'translate(-50%, -50%)';
        mainText.style.fontSize = DEATH_TEXT_SIZE;
        mainText.style.fontFamily = 'Arial Black, sans-serif';
        mainText.style.color = textColor;
        mainText.style.textShadow = `${DEATH_TEXT_STROKE_THICKNESS}px ${DEATH_TEXT_STROKE_THICKNESS}px ${strokeColor}`;
        mainText.style.whiteSpace = 'nowrap';
        textContainer.appendChild(mainText);
        
        document.getElementById('game').appendChild(textContainer);
        
        // Add animations
        if (isGameOver) {
            // Initial fade in
            textContainer.style.opacity = '0';
            const fadeInAnimation = textContainer.animate([
                { opacity: 0, transform: 'translate(-50%, -50%)' },
                { opacity: 1, transform: 'translate(-50%, -50%)' }
            ], {
                duration: 1000,
                easing: 'ease-out',
                fill: 'forwards'
            });

            // Wave animation
            const waveAnimation = textContainer.animate([
                { transform: 'translate(-50%, -50%)' },
                { transform: `translate(-50%, calc(-50% + ${WAVE_AMPLITUDE}px))` },
                { transform: 'translate(-50%, -50%)' }
            ], {
                duration: 2000,
                iterations: 2,
                easing: 'ease-in-out'
            });

            // After wave animation, fade out
            waveAnimation.onfinish = () => {
                textContainer.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], {
                    duration: 1000,
                    easing: 'ease-in',
                    fill: 'forwards'
                }).onfinish = () => {
                    textContainer.remove();
                };
            };
        } else {
            // Regular death animation (unchanged)
            const flashAnimation = textContainer.animate([
                { opacity: 1 },
                { opacity: 0.2 }
            ], {
                duration: DEATH_TEXT_DURATION / (DEATH_TEXT_FLASH_COUNT * 2),
                iterations: DEATH_TEXT_FLASH_COUNT * 2,
                direction: 'alternate',
                easing: 'ease-in-out'
            });
            
            flashAnimation.onfinish = () => {
                textContainer.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], {
                    duration: 500,
                    fill: 'forwards',
                    easing: 'ease-in'
                }).onfinish = () => {
                    textContainer.remove();
                };
            };
            
            // Scale animation
            textContainer.animate([
                { transform: 'translate(-50%, -50%) scale(1)' },
                { transform: 'translate(-50%, -50%) scale(1.1)' }
            ], {
                duration: DEATH_TEXT_DURATION / (DEATH_TEXT_FLASH_COUNT * 2),
                iterations: DEATH_TEXT_FLASH_COUNT * 2,
                direction: 'alternate',
                easing: 'ease-in-out'
            });
        }
        
        return textContainer;
    }

    showDeathText() {
        // Remove existing death text if any
        const existingText = document.querySelector('.death-text-container');
        if (existingText) {
            existingText.remove();
        }
        
        deathText = this.createDeathText();
        deathText.classList.add('death-text-container');
    }

    playerDeath() {
        if (!isPlayerDead) {
            isPlayerDead = true;
            player.setVelocity(0, 0);
            
            // Show death text first
            this.showDeathText();
            
            // Decrease lives
            currentLives--;
            this.updateLivesDisplay();
            
            // Start blinking after death text
            this.time.delayedCall(DEATH_TEXT_DURATION, () => {
                let blinks = 0;
                const blinkInterval = setInterval(() => {
                    playerGraphics.visible = !playerGraphics.visible;
                    blinks++;
                    
                    if (blinks >= BLINK_TIMES * 2) {
                        clearInterval(blinkInterval);
                        playerGraphics.visible = true;
                        
                        if (currentLives <= 0) {
                            currentLevel = Math.max(1, currentLevel - 1);
                            currentLives = MAX_LIVES;
                            this.updateLivesDisplay();
                        }
                        
                        this.resetGame();
                    }
                }, BLINK_INTERVAL);
            });
        }
    }

    createVictoryText() {
        // Create container for victory text
        const textContainer = document.createElement('div');
        textContainer.style.position = 'fixed';
        textContainer.style.top = '50%';
        textContainer.style.left = '50%';
        textContainer.style.transform = 'translate(-50%, -50%)';
        textContainer.style.zIndex = '1000';
        textContainer.style.pointerEvents = 'none';
        
        // Create glow layers
        for (let i = VICTORY_GLOW_LAYERS; i > 0; i--) {
            const glowText = document.createElement('div');
            glowText.textContent = 'VICTORY!';
            glowText.style.position = 'absolute';
            glowText.style.left = '50%';
            glowText.style.top = '50%';
            glowText.style.transform = 'translate(-50%, -50%) scale(' + (1 + (i * 0.1)) + ')';
            glowText.style.fontSize = '120px';
            glowText.style.fontFamily = 'Arial Black, sans-serif';
            glowText.style.color = '#ffd700';
            glowText.style.textShadow = `0 0 ${i * 10}px #ffd700`;
            glowText.style.opacity = 0.2 - (i * 0.03);
            glowText.style.whiteSpace = 'nowrap';
            textContainer.appendChild(glowText);
        }
        
        // Create main text
        const mainText = document.createElement('div');
        mainText.textContent = 'VICTORY!';
        mainText.style.position = 'absolute';
        mainText.style.left = '50%';
        mainText.style.top = '50%';
        mainText.style.transform = 'translate(-50%, -50%)';
        mainText.style.fontSize = '120px';
        mainText.style.fontFamily = 'Arial Black, sans-serif';
        mainText.style.color = '#ffd700';
        mainText.style.textShadow = '0 0 10px #ffd700';
        mainText.style.whiteSpace = 'nowrap';
        textContainer.appendChild(mainText);
        
        document.getElementById('game').appendChild(textContainer);
        return textContainer;
    }

    createFadeOverlay() {
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = '#000';
        overlay.style.opacity = '0';
        overlay.style.zIndex = '999';
        overlay.style.pointerEvents = 'none';
        document.getElementById('game').appendChild(overlay);
        return overlay;
    }

    showVictoryEffect() {
        if (victoryText) {
            victoryText.remove();
        }
        
        // Freeze player
        player.setVelocity(0, 0);
        player.body.allowGravity = false;
        
        // Create and show victory text
        victoryText = this.createVictoryText();
        
        // Initial state - invisible
        victoryText.style.opacity = '0';
        
        // Create fade overlay
        const fadeOverlay = this.createFadeOverlay();
        
        // Sequence of animations
        const sequence = async () => {
            // 1. Fade in victory text with pulse
            await new Promise(resolve => {
                victoryText.animate([
                    { opacity: 0, transform: 'translate(-50%, -50%) scale(0.8)' },
                    { opacity: 1, transform: 'translate(-50%, -50%) scale(1.1)' },
                    { opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }
                ], {
                    duration: 1000,
                    easing: 'ease-out',
                    fill: 'forwards'
                }).onfinish = resolve;
            });
            
            // 2. Pulse animation
            const pulseAnimation = victoryText.animate([
                { transform: 'translate(-50%, -50%) scale(1)' },
                { transform: 'translate(-50%, -50%) scale(1.1)' },
                { transform: 'translate(-50%, -50%) scale(1)' }
            ], {
                duration: 1000,
                iterations: 3,
                easing: 'ease-in-out'
            });
            
            await new Promise(resolve => {
                pulseAnimation.onfinish = resolve;
            });
            
            // 3. Fade to black
            await new Promise(resolve => {
                fadeOverlay.animate([
                    { opacity: 0 },
                    { opacity: 1 }
                ], {
                    duration: FADE_DURATION,
                    fill: 'forwards',
                    easing: 'ease-in'
                }).onfinish = resolve;
            });
            
            // 4. Clean up and proceed to next level
            victoryText.remove();
            
            // Progress to next level
            currentLevel++;
            currentLives = MAX_LIVES;
            this.updateLivesDisplay();
            this.resetGame(true);
            
            // 5. Fade from black
            await new Promise(resolve => {
                fadeOverlay.animate([
                    { opacity: 1 },
                    { opacity: 0 }
                ], {
                    duration: FADE_DURATION,
                    fill: 'forwards',
                    easing: 'ease-out'
                }).onfinish = resolve;
            });
            
            // Clean up overlay
            fadeOverlay.remove();
        };
        
        sequence();
    }

    reachCheckpoint() {
        if (!isPlayerDead && !isLevelTransitioning) {
            isLevelTransitioning = true;
            this.showVictoryEffect();
        }
    }

    resetGame(levelComplete = false, loadingSave = false) {
        // Clean up any existing victory text
        if (victoryText) {
            victoryText.remove();
            victoryText = null;
        }
        
        // Update record if current distance is higher
        if (currentDistance > recordDistance) {
            recordDistance = currentDistance;
        }
        
        // Reset current distance
        currentDistance = 0;
        
        // Only reset level if not completed and no lives left
        if (!levelComplete && currentLives <= 0) {
            currentLevel = Math.max(1, currentLevel - 1);
        }
        
        // Re-enable player physics if it was disabled
        if (player) {
            player.body.allowGravity = true;
        }
        
        // Clear existing terrain and lava
        platforms.clear(true, true);
        branches.clear(true, true);
        lavaGroup.forEach(lava => {
            lava.group.destroy(true);
            lava.collider.destroy();
        });
        lavaGroup.clear();
        
        // Recreate initial terrain segments
        for(let x = 0; x < window.innerWidth + 1000; x += GAP_SPACING) {
            const segment = this.createTerrainSegment(x);
        }
        
        // Reset player position
        player.setVelocity(0, 0);
        player.x = 100;
        player.y = window.innerHeight - GROUND_HEIGHT - PLAYER_HEIGHT;
        this.cameras.main.scrollX = 0;
        
        // Reset game state
        isPlayerDead = false;
        blinkCount = 0;
        isLevelTransitioning = false;
        
        // Create new checkpoint
        this.updateCheckpoint();
        
        // Update UI
        this.updateUI();
        
        // Reestablish lava collision
        lavaGroup.forEach(lava => {
            this.physics.add.overlap(player, lava.collider, this.playerDeath, null, this);
        });

        if (loadingSave) {
            const savedState = loadGameState();
            if (savedState) {
                currentLevel = savedState.currentLevel;
                currentDistance = savedState.currentDistance;
                recordDistance = savedState.recordDistance;
                currentLives = savedState.currentLives;
                
                // Adjust player position to saved position
                player.x = savedState.lastCheckpointX;
                this.cameras.main.scrollX = player.x - 200; // Adjust camera
            }
        }
    }

    createDeathLine() {
        // Calculate Y position (below lowest lava point)
        const lowestLavaY = window.innerHeight - GROUND_HEIGHT/2 + LAVA_FLOAT_AMPLITUDE;
        const deathLineY = lowestLavaY + DEATH_LINE_Y_OFFSET;
        
        // Create line graphics
        const lineGraphics = this.add.graphics();
        
        // Create the actual line
        const line = new Phaser.Geom.Line(
            -1000, // Start well off-screen
            deathLineY,
            window.innerWidth + 2000, // End well off-screen
            deathLineY
        );
        
        return { graphics: lineGraphics, line: line, time: 0 };
    }

    updateDeathLine() {
        if (!deathLine) return;
        
        // Update line position relative to camera
        const camX = this.cameras.main.scrollX;
        deathLine.line.x1 = camX - 1000;
        deathLine.line.x2 = camX + window.innerWidth + 1000;
        
        // Animate line alpha for signal effect
        deathLine.time += SIGNAL_WAVE_SPEED * 0.016; // Convert to seconds
        const alpha = DEATH_LINE_ALPHA + Math.sin(deathLine.time) * SIGNAL_WAVE_AMPLITUDE;
        
        // Redraw line
        deathLine.graphics.clear();
        deathLine.graphics.lineStyle(DEATH_LINE_THICKNESS, DEATH_LINE_COLOR, alpha);
        deathLine.graphics.strokeLineShape(deathLine.line);
    }

    checkDeathLineCollision() {
        if (!deathLine || isPlayerDead) return;
        
        // Check if player is below death line
        if (player.y > deathLine.line.y1) {
            this.playerDeath();
        }
    }

    startDash(direction) {
        if (!canDash || isDashing || isSliding) return;
        
        isDashing = true;
        canDash = false;
        player.setVelocityX(direction * PLAYER_DASH_SPEED);
        
        // End dash after duration
        this.time.delayedCall(PLAYER_DASH_DURATION, () => {
            isDashing = false;
            player.setVelocityX(0);
            
            // Reset dash cooldown
            this.time.delayedCall(PLAYER_DASH_COOLDOWN, () => {
                canDash = true;
            });
        });
    }

    startSlide(direction) {
        if (isSliding || !player.body.touching.down) return;
        
        isSliding = true;
        currentSlideSpeed = direction * PLAYER_SLIDE_SPEED;
        player.setSize(PLAYER_WIDTH, PLAYER_CROUCH_HEIGHT, true);
        
        // End slide after duration
        this.time.delayedCall(PLAYER_SLIDE_DURATION, () => {
            isSliding = false;
            if (!cursors.down.isDown) {
                player.setSize(PLAYER_WIDTH, PLAYER_HEIGHT, true);
            }
        });
    }
}

// Initialize game with config
const config = {
    type: Phaser.WEBGL,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: {
                showBody: true,
                showStaticBody: true,
                bodyColor: 0x000000,
                staticBodyColor: 0x000000
            }
        }
    },
    scene: [TitleScene, GameScene],
    backgroundColor: '#000000',
    render: {
        pixelArt: false,
        antialias: true,
        willReadFrequently: true
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    }
};

// Create game instance
const game = new Phaser.Game(config);

// Handle window resize
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});