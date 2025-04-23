import { Scene } from 'phaser';
import { ASSET_KEYS, CARD_HEIGHT, CARD_WIDTH, SCENE_KEYS } from './Commons';

export class Preloader extends Scene {
    constructor() {
        super({ key: SCENE_KEYS.PRELOAD });
    }

    preload() {
        this.load.image(ASSET_KEYS.TITLE, 'assets/title.png');
        this.load.image(ASSET_KEYS.CLICK_TO_START, 'assets/start.png');
        this.load.image(ASSET_KEYS.TABLE, 'assets/table.png');
        this.load.image(ASSET_KEYS.WIN, 'assets/win.png');
        this.load.image(ASSET_KEYS.PLAY_AGAIN, 'assets/playAgain.png');
        this.load.spritesheet(ASSET_KEYS.CARDS, 'assets/cards.png', {
            frameWidth: CARD_WIDTH,
            frameHeight: CARD_HEIGHT
        });
    }

    create() {
        this.scene.start(SCENE_KEYS.GAME);
    }
}
