export class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        // Get game dimensions
        const width = this.scale.width;
        const height = this.scale.height;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLandscape = width > height;

        // Create title text
        const titleText = this.add.text(width / 2, height * 0.3, 'ISLAND CRISIS', {
            fontSize: Math.min(width * 0.15, 72) + 'px',
            fontFamily: 'Arial Black',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6,
            shadow: {
                offsetX: 2,
                offsetY: 2,
                color: '#000',
                blur: 2,
                stroke: true,
                fill: true
            }
        }).setOrigin(0.5);

        // Create menu options
        const menuOptions = ['START', 'CONTINUE'];
        const menuItems = [];
        const menuSpacing = Math.min(height * 0.15, 60);
        const fontSize = Math.min(width * 0.08, 36);

        menuOptions.forEach((option, index) => {
            const y = height * 0.5 + (index * menuSpacing);
            const menuItem = this.add.text(width / 2, y, option, {
                fontSize: fontSize + 'px',
                fontFamily: 'Arial Black',
                color: '#808080',
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5);

            menuItems.push(menuItem);
        });

        // Check for saved game
        const savedState = localStorage.getItem('islandCrisisGameState');
        if (!savedState) {
            menuItems[1].setAlpha(0.5);
        } else {
            // Show saved game info
            const savedData = JSON.parse(savedState);
            const saveInfo = this.add.text(width / 2, height * 0.7, 
                `Level ${savedData.currentLevel} - ${Math.floor(savedData.currentDistance)}m`, {
                fontSize: Math.min(width * 0.05, 24) + 'px',
                fontFamily: 'Arial',
                color: '#00ff00',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);
        }

        // Menu selection
        let selectedIndex = 0;
        const updateSelection = () => {
            menuItems.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.setColor('#ffffff');
                    item.setScale(1.1);
                } else {
                    item.setColor('#808080');
                    item.setScale(1);
                }
            });
        };

        // Handle keyboard input
        this.input.keyboard.on('keydown-W', () => {
            selectedIndex = Math.max(0, selectedIndex - 1);
            updateSelection();
        });

        this.input.keyboard.on('keydown-S', () => {
            selectedIndex = Math.min(menuItems.length - 1, selectedIndex + 1);
            updateSelection();
        });

        this.input.keyboard.on('keydown-ENTER', () => {
            this.handleSelection(selectedIndex);
        });

        // Handle touch input for mobile
        if (isMobile) {
            const touchZone = this.add.zone(0, 0, width, height)
                .setOrigin(0)
                .setInteractive();

            touchZone.on('pointerdown', (pointer) => {
                const touchY = pointer.y;
                const menuStartY = height * 0.5;
                const touchIndex = Math.floor((touchY - menuStartY) / menuSpacing);
                
                if (touchIndex >= 0 && touchIndex < menuItems.length) {
                    selectedIndex = touchIndex;
                    updateSelection();
                    this.handleSelection(selectedIndex);
                }
            });
        }

        // Initial selection
        updateSelection();

        // Handle selection
        this.handleSelection = (index) => {
            if (index === 1 && !savedState) return; // Don't allow continue if no save exists
            
            const selectedOption = menuOptions[index];
            if (selectedOption === 'START') {
                this.scene.start('GameScene');
            } else if (selectedOption === 'CONTINUE' && savedState) {
                this.scene.start('GameScene', { loadSave: true });
            }
        };

        // Handle orientation changes
        this.scale.on('orientationchange', () => {
            this.scene.restart();
        });
    }
} 