class TitleScene extends Phaser.Scene {
    constructor() {
        super({ key: 'TitleScene' });
    }

    create() {
        // Create title menu container
        this.menuContainer = document.createElement('div');
        this.menuContainer.style.position = 'fixed';
        this.menuContainer.style.top = '50%';
        this.menuContainer.style.left = '50%';
        this.menuContainer.style.transform = 'translate(-50%, -50%)';
        this.menuContainer.style.display = 'flex';
        this.menuContainer.style.flexDirection = 'column';
        this.menuContainer.style.alignItems = 'center';
        this.menuContainer.style.gap = '20px';
        this.menuContainer.style.zIndex = '1000';

        // Create title
        const titleText = document.createElement('div');
        titleText.textContent = 'ISLAND CRISIS';
        titleText.style.fontSize = '72px';
        titleText.style.fontFamily = MENU_FONT;
        titleText.style.color = '#ffd700';
        titleText.style.marginBottom = '40px';
        titleText.style.textShadow = '0 0 10px #ffd700';
        this.menuContainer.appendChild(titleText);

        // Check for saved game
        const savedState = localStorage.getItem('islandCrisisGameState');
        const hasSavedGame = savedState !== null;

        // Create menu options
        this.startOption = document.createElement('div');
        this.startOption.textContent = 'START';
        this.startOption.style.fontSize = MENU_TEXT_SIZE;
        this.startOption.style.fontFamily = MENU_FONT;
        this.startOption.style.cursor = 'pointer';

        this.continueOption = document.createElement('div');
        this.continueOption.textContent = 'CONTINUE';
        this.continueOption.style.fontSize = MENU_TEXT_SIZE;
        this.continueOption.style.fontFamily = MENU_FONT;
        this.continueOption.style.cursor = hasSavedGame ? 'pointer' : 'default';
        
        // Add saved game info if available
        if (hasSavedGame) {
            const savedData = JSON.parse(savedState);
            const saveInfo = document.createElement('div');
            saveInfo.textContent = `Level ${savedData.currentLevel} - ${Math.floor(savedData.currentDistance)}m`;
            saveInfo.style.fontSize = '16px';
            saveInfo.style.color = '#808080';
            saveInfo.style.marginTop = '-15px';
            this.continueOption.appendChild(saveInfo);
        } else {
            this.continueOption.style.color = '#404040';
        }

        this.menuContainer.appendChild(this.startOption);
        this.menuContainer.appendChild(this.continueOption);

        document.getElementById('game').appendChild(this.menuContainer);

        this.selectedOption = 0;
        this.hasSavedGame = hasSavedGame;
        this.updateMenuSelection();

        // Add keyboard controls
        this.input.keyboard.on('keydown-W', () => {
            this.selectedOption = Math.max(0, this.selectedOption - 1);
            if (!this.hasSavedGame && this.selectedOption === 1) {
                this.selectedOption = 0;
            }
            this.updateMenuSelection();
        });

        this.input.keyboard.on('keydown-S', () => {
            this.selectedOption = Math.min(1, this.selectedOption + 1);
            if (!this.hasSavedGame && this.selectedOption === 1) {
                this.selectedOption = 0;
            }
            this.updateMenuSelection();
        });

        this.input.keyboard.on('keydown-ENTER', () => {
            this.handleSelection();
        });
    }

    updateMenuSelection() {
        this.startOption.style.color = this.selectedOption === 0 ? MENU_SELECTED_COLOR : MENU_UNSELECTED_COLOR;
        if (this.hasSavedGame) {
            this.continueOption.style.color = this.selectedOption === 1 ? MENU_SELECTED_COLOR : MENU_UNSELECTED_COLOR;
        }
    }

    handleSelection() {
        // Don't allow continue if no saved game
        if (this.selectedOption === 1 && !this.hasSavedGame) {
            return;
        }

        // Remove menu
        if (this.menuContainer && this.menuContainer.parentNode) {
            this.menuContainer.parentNode.removeChild(this.menuContainer);
        }

        if (this.selectedOption === 0) {
            // Start new game
            localStorage.removeItem('islandCrisisGameState'); // Clear any existing save
            currentLevel = 1;
            currentLives = MAX_LIVES;
            currentDistance = 0;
            recordDistance = 0;
            this.scene.start('GameScene');
        } else {
            // Continue from saved game
            this.scene.start('GameScene', { loadSave: true });
        }
    }
} 