import { Scene } from 'phaser';
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS } from './Commons';

export class Preloader extends Scene {
    constructor() {
        super({ key: SCENE_KEYS.PRELOAD });
    }

    preload() {
        this.load.font('Raleway', 'fonts/Raleway.ttf')

        this.load.image(ASSET_KEYS.TITLE, 'assets/title.webp');
        this.load.image(ASSET_KEYS.CLICK_TO_START, 'assets/start.webp');
        this.load.image(ASSET_KEYS.TABLE, 'assets/table.webp');
        this.load.image(ASSET_KEYS.BANNER, 'assets/banner.webp');
        this.load.image(ASSET_KEYS.WIN, 'assets/win.webp');
        this.load.image(ASSET_KEYS.PLAY_AGAIN, 'assets/playAgain.webp');
        this.load.spritesheet(ASSET_KEYS.CARDS, 'assets/cards.webp', {
            frameWidth: CARD_WIDTH,
            frameHeight: CARD_HEIGHT
        });

        this.load.audio('cardDrop', 'assets/sfx/card-drop.mp3')
    }

    create() {
        this.scene.start(SCENE_KEYS.TITLE);
    }
}
