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
    scene: {
        preload: preload,
        create: create,
        update: update
    },
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

const game = new Phaser.Game(config);

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
let isLevelTransitioning = false;

// Constants
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
const VICTORY_DURATION = 3000; // Extended to 3 seconds
const VICTORY_GLOW_LAYERS = 5;
const VICTORY_GLOW_COLOR = 0xffd700; // Gold color

function preload() {
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

function createTree(x, groundY) {
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

function createLava(x, width) {
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

function createUIElements() {
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

    updateUI();
}

function updateUI() {
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
        levelText.textContent = `Level: ${currentLevel} (${getCheckpointDistance()}m to go)`;
    }
}

function createTerrainSegment(x) {
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
    const lava = createLava.call(this, x + groundWidth, GAP_WIDTH);
    lavaGroup.add(lava);
    
    // Add random trees along the ground segment
    const treesPerSegment = Math.floor(groundWidth / 100);
    for (let i = 0; i < treesPerSegment; i++) {
        if (Math.random() < TREE_CHANCE) {
            const treeX = x + (i * 100) + Phaser.Math.Between(50, 80);
            createTree.call(this, treeX, groundY - GROUND_HEIGHT/2);
        }
    }
    
    return { ground: ground, lava: lava };
}

function getCheckpointDistance() {
    return BASE_CHECKPOINT_DISTANCE * currentLevel;
}

function createCheckpoint(scene, x, y) {
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
    
    // Add collision circle
    const collider = scene.physics.add.sprite(x, y);
    collider.setCircle(CHECKPOINT_RADIUS);
    collider.setImmovable(true);
    collider.body.allowGravity = false;
    collider.visible = false;
    
    return { group: checkpointGroup, collider: collider };
}

function updateCheckpoint() {
    if (checkpoint) {
        checkpoint.group.destroy(true);
        checkpoint.collider.destroy();
    }
    
    const checkpointX = (getCheckpointDistance() * 50) + 100; // Convert back from display distance
    const checkpointY = window.innerHeight - GROUND_HEIGHT - CHECKPOINT_HEIGHT;
    
    checkpoint = createCheckpoint(this, checkpointX, checkpointY);
    
    // Add overlap detection with player
    this.physics.add.overlap(player, checkpoint.collider, reachCheckpoint, null, this);
}

function createLivesDisplay() {
    // Create container for lives
    const livesDiv = document.createElement('div');
    livesDiv.style.position = 'absolute';
    livesDiv.style.top = '20px';
    livesDiv.style.right = '150px'; // Position before the record text
    livesDiv.style.display = 'flex';
    livesDiv.style.gap = '5px';
    document.getElementById('game').appendChild(livesDiv);
    livesContainer = livesDiv;
    
    updateLivesDisplay();
}

function updateLivesDisplay() {
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

function playerDeath() {
    if (!isPlayerDead) {
        isPlayerDead = true;
        player.setVelocity(0, 0);
        
        // Decrease lives
        currentLives--;
        updateLivesDisplay();
        
        let blinks = 0;
        const blinkInterval = setInterval(() => {
            playerGraphics.visible = !playerGraphics.visible;
            blinks++;
            
            if (blinks >= BLINK_TIMES * 2) {
                clearInterval(blinkInterval);
                playerGraphics.visible = true;
                
                if (currentLives <= 0) {
                    // If no lives left, drop a level and restore lives
                    currentLevel = Math.max(1, currentLevel - 1);
                    currentLives = MAX_LIVES;
                    updateLivesDisplay();
                }
                
                resetGame.call(this);
            }
        }, BLINK_INTERVAL);
    }
}

function createVictoryText() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    // Create glow effect
    const glowGroup = this.add.group();
    for (let i = VICTORY_GLOW_LAYERS; i > 0; i--) {
        const text = this.add.text(centerX, centerY, 'VICTORY', {
            fontSize: '120px',
            fontFamily: 'Arial',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 6
        });
        text.setOrigin(0.5);
        text.setAlpha(0.2 - (i * 0.03));
        text.setScale(1 + (i * 0.1));
        glowGroup.add(text);
    }
    
    // Create main text
    const mainText = this.add.text(centerX, centerY, 'VICTORY', {
        fontSize: '120px',
        fontFamily: 'Arial',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 6
    });
    mainText.setOrigin(0.5);
    glowGroup.add(mainText);
    
    return glowGroup;
}

function showVictoryEffect() {
    if (victoryText) {
        victoryText.destroy(true);
    }
    
    victoryText = createVictoryText.call(this);
    
    // Pause player movement during victory animation
    player.setVelocity(0, 0);
    player.body.allowGravity = false;
    
    // Add fade out effect
    this.tweens.add({
        targets: victoryText.getChildren(),
        alpha: 0,
        duration: VICTORY_DURATION,
        ease: 'Power2',
        onComplete: () => {
            if (victoryText) {
                victoryText.destroy(true);
                victoryText = null;
            }
            // Re-enable player physics
            player.body.allowGravity = true;
            isLevelTransitioning = false;
        }
    });
}

function reachCheckpoint() {
    if (!isPlayerDead && !isLevelTransitioning) {
        isLevelTransitioning = true;
        showVictoryEffect.call(this);
        
        // Wait for victory effect before proceeding
        this.time.delayedCall(VICTORY_DURATION, () => {
            currentLevel++;
            currentLives = MAX_LIVES; // Restore lives on level completion
            updateLivesDisplay();
            resetGame.call(this, true);
        });
    }
}

function resetGame(levelComplete = false) {
    // Clean up any existing victory text
    if (victoryText) {
        victoryText.destroy(true);
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
        const segment = createTerrainSegment.call(this, x);
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
    updateCheckpoint.call(this);
    
    // Update UI
    updateUI();
    
    // Reestablish lava collision
    lavaGroup.forEach(lava => {
        this.physics.add.overlap(player, lava.collider, playerDeath, null, this);
    });
}

function create() {
    platforms = this.physics.add.staticGroup();
    branches = this.physics.add.staticGroup();
    lavaGroup = new Set();
    
    // Create initial terrain segments
    for(let x = 0; x < window.innerWidth + 1000; x += GAP_SPACING) {
        const segment = createTerrainSegment.call(this, x);
    }
    
    // Create UI elements
    createUIElements();
    createLivesDisplay();
    
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
    updateCheckpoint.call(this);
    
    // Set up keyboard controls
    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });
    
    // Set up camera
    this.cameras.main.startFollow(player, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(100, 100);
    
    // Add lava collision
    lavaGroup.forEach(lava => {
        this.physics.add.overlap(player, lava.collider, playerDeath, null, this);
    });
}

function update() {
    if (isPlayerDead) return;
    
    // Update distance based on player position
    currentDistance = Math.max(0, player.x - 100) / 50; // Divide by 50 to make the distance more readable
    
    // Animate checkpoint glow
    if (checkpoint) {
        const time = this.time.now / 1000;
        checkpoint.group.getChildren().forEach((circle, index) => {
            const pulseScale = 1 + Math.sin(time * 2) * 0.1;
            circle.setScale(pulseScale);
        });
    }
    
    updateUI();
    
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
                    createTree.call(this, treeX, groundY - GROUND_HEIGHT/2);
                }
            }
            
            // Create new lava for recycled segment
            const newLava = createLava.call(this, newX + groundWidth, GAP_WIDTH);
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

    // Handle player movement
    if (cursors.left.isDown) {
        player.setVelocityX(-PLAYER_SPEED);
    } else if (cursors.right.isDown) {
        player.setVelocityX(PLAYER_SPEED);
    } else {
        player.setVelocityX(0);
    }
    
    // Handle jumping
    if (cursors.up.isDown && player.body.touching.down) {
        player.setVelocityY(PLAYER_JUMP_SPEED);
    }
    
    // Handle crouching
    if (cursors.down.isDown && player.body.touching.down) {
        if (player.height !== PLAYER_CROUCH_HEIGHT) {
            player.setSize(PLAYER_WIDTH, PLAYER_CROUCH_HEIGHT, true);
        }
    } else {
        if (player.height !== PLAYER_HEIGHT) {
            player.setSize(PLAYER_WIDTH, PLAYER_HEIGHT, true);
        }
    }
    
    // Draw player as a simple red rectangle
    playerGraphics.clear();
    playerGraphics.fillStyle(0xff0000);
    playerGraphics.fillRect(
        player.x - player.width/2,
        player.y - player.height/2,
        player.width,
        player.height
    );
}

// Handle window resize
window.addEventListener('resize', () => {
    game.scale.resize(window.innerWidth, window.innerHeight);
});