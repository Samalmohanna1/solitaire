import { Game as GameScene } from './scenes/Game';
import { Title as TitleScene } from './scenes/Title';
import { Preloader as PreloadScene } from './scenes/Preloader';

import { Game, Types } from "phaser";
import { Win } from './scenes/Win';

const config: Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    backgroundColor: '#5c5b5b',
    scale: {
        parent: 'game-container',
        width: 1920,
        height: 1080,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        mode: Phaser.Scale.FIT
    },
    scene: [
        PreloadScene, TitleScene, GameScene, Win
    ]
};

window.onload = () => {
    new Game(config)
}