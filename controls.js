export class Controls {
    constructor(scene) {
        this.scene = scene;
        this.cursors = null;
        this.touchControls = {};
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.swipeThreshold = 50;
        this.doubleTapThreshold = 300;
        this.lastTapTime = 0;
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        this.isLandscape = window.innerWidth > window.innerHeight;
        this.isVirtualTouch = false; // Track if we're in virtual touchscreen mode
        
        // Input states
        this.left = false;
        this.right = false;
        this.up = false;
        this.down = false;
        this.dash = false;
        
        this.initKeyboardControls();
        this.detectVirtualTouch();
    }

    detectVirtualTouch() {
        // Check if we're in virtual touchscreen mode (Chrome DevTools)
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        if (isChrome) {
            // Listen for touch events to detect virtual touchscreen mode
            const touchHandler = (e) => {
                this.isVirtualTouch = true;
                this.initTouchControls();
                document.removeEventListener('touchstart', touchHandler);
            };
            document.addEventListener('touchstart', touchHandler);
        }
    }

    initKeyboardControls() {
        // Set up keyboard controls
        this.cursors = this.scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
        });

        // Prevent key events from bubbling
        this.scene.input.keyboard.on('keydown', (event) => {
            event.preventDefault();
        });
    }

    initTouchControls() {
        if (this.touchControls.leftZone) return; // Already initialized
        
        // Create touch control overlay
        const gameContainer = document.getElementById('game');
        
        // Create touch zones
        this.touchControls.leftZone = this.createTouchZone('left-zone', '0', '0', '33%', '100%');
        this.touchControls.rightZone = this.createTouchZone('right-zone', '67%', '0', '33%', '100%');
        this.touchControls.jumpZone = this.createTouchZone('jump-zone', '33%', '0', '34%', '50%');
        this.touchControls.crouchZone = this.createTouchZone('crouch-zone', '33%', '50%', '34%', '50%');
        
        // Add touch zones to game container
        Object.values(this.touchControls).forEach(zone => {
            gameContainer.appendChild(zone);
        });

        // Add touch event listeners
        this.scene.input.on('pointerdown', this.handleTouchStart, this);
        this.scene.input.on('pointermove', this.handleTouchMove, this);
        this.scene.input.on('pointerup', this.handleTouchEnd, this);

        // Initially hide touch controls
        this.setTouchControlsVisibility(false);
    }

    handleOrientation() {
        // Add orientation change listener
        window.addEventListener('orientationchange', () => {
            this.isLandscape = window.innerWidth > window.innerHeight;
            this.updateOrientation();
        });

        // Add resize listener for desktop browsers
        window.addEventListener('resize', () => {
            this.isLandscape = window.innerWidth > window.innerHeight;
            this.updateOrientation();
        });

        // Initial orientation check
        this.updateOrientation();
    }

    updateOrientation() {
        if (this.isMobile) {
            if (this.isLandscape) {
                this.scene.scene.resume();
                this.setTouchControlsVisibility(true);
            } else {
                this.scene.scene.pause();
                this.setTouchControlsVisibility(false);
            }
        }
    }

    setTouchControlsVisibility(visible) {
        if (!this.isVirtualTouch) return;
        
        Object.values(this.touchControls).forEach(zone => {
            zone.style.display = visible ? 'block' : 'none';
        });
    }

    createTouchZone(id, left, top, width, height) {
        const zone = document.createElement('div');
        zone.id = id;
        zone.style.position = 'absolute';
        zone.style.left = left;
        zone.style.top = top;
        zone.style.width = width;
        zone.style.height = height;
        zone.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        zone.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        zone.style.borderRadius = '10px';
        zone.style.margin = '10px';
        zone.style.touchAction = 'none';
        zone.style.pointerEvents = 'auto';
        zone.style.display = 'none';
        return zone;
    }

    handleTouchStart(pointer) {
        if (!this.isVirtualTouch || !this.isLandscape) return;
        
        this.touchStartX = pointer.x;
        this.touchStartY = pointer.y;
        
        // Check which zone was touched
        const touchX = pointer.x;
        const touchY = pointer.y;
        const gameWidth = this.scene.game.config.width;
        const gameHeight = this.scene.game.config.height;
        
        // Left zone
        if (touchX < gameWidth * 0.33) {
            this.left = true;
            this.right = false;
        }
        // Right zone
        else if (touchX > gameWidth * 0.67) {
            this.right = true;
            this.left = false;
        }
        // Jump zone
        else if (touchY < gameHeight * 0.5) {
            this.up = true;
        }
        // Crouch zone
        else {
            this.down = true;
        }

        // Check for double tap (dash)
        const currentTime = Date.now();
        if (currentTime - this.lastTapTime < this.doubleTapThreshold) {
            this.dash = true;
        }
        this.lastTapTime = currentTime;
    }

    handleTouchMove(pointer) {
        if (!this.isVirtualTouch || !this.isLandscape) return;
        
        // Calculate swipe distance
        const swipeX = pointer.x - this.touchStartX;
        const swipeY = pointer.y - this.touchStartY;
        
        // Update touch start position for next move
        this.touchStartX = pointer.x;
        this.touchStartY = pointer.y;
        
        // Handle swipe gestures
        if (Math.abs(swipeX) > this.swipeThreshold) {
            this.left = swipeX < 0;
            this.right = swipeX > 0;
        }
        
        if (Math.abs(swipeY) > this.swipeThreshold) {
            this.up = swipeY < 0;
            this.down = swipeY > 0;
        }
    }

    handleTouchEnd() {
        if (!this.isVirtualTouch || !this.isLandscape) return;
        
        // Reset all touch-based inputs
        this.left = false;
        this.right = false;
        this.up = false;
        this.down = false;
        this.dash = false;
    }

    update() {
        // Reset all input states first
        this.left = false;
        this.right = false;
        this.up = false;
        this.down = false;
        this.dash = false;

        if (!this.scene.scene.isPaused()) {
            // Update from keyboard
            if (this.cursors.left.isDown) this.left = true;
            if (this.cursors.right.isDown) this.right = true;
            if (this.cursors.up.isDown) this.up = true;
            if (this.cursors.down.isDown) this.down = true;
            if (this.cursors.shift.isDown) this.dash = true;
        }

        return {
            left: this.left,
            right: this.right,
            up: this.up,
            down: this.down,
            dash: this.dash
        };
    }

    cleanup() {
        // Remove touch zones
        Object.values(this.touchControls).forEach(zone => {
            if (zone.parentNode) {
                zone.parentNode.removeChild(zone);
            }
        });
        
        // Remove event listeners
        this.scene.input.off('pointerdown', this.handleTouchStart, this);
        this.scene.input.off('pointermove', this.handleTouchMove, this);
        this.scene.input.off('pointerup', this.handleTouchEnd, this);
        
        // Remove orientation listeners
        window.removeEventListener('orientationchange', this.updateOrientation);
        window.removeEventListener('resize', this.updateOrientation);
    }
} 