import { Game as GameScene } from './scenes/Game';
import { Title as TitleScene } from './scenes/Title';
import { Preloader as PreloadScene } from './scenes/Preloader';

import { Game, Types } from "phaser";

const config: Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    backgroundColor: '#5c5b5b',
    scale: {
        parent: 'game-container',
        width: 640,
        height: 360,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        mode: Phaser.Scale.FIT
    },
    scene: [
        PreloadScene, TitleScene, GameScene
    ]
};

// export default new Game(config);
window.onload = () => {
    new Game(config)
}