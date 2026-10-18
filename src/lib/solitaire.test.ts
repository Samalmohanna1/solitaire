import { afterEach, describe, expect, it, vi } from 'vitest';
import { Card } from './card';
import { CardSuit, CardValue } from './common';
import { SCORE, Solitaire } from './solitaire';
import { shuffleArray } from './utils';

function card(value: CardValue, suit: CardSuit, isFaceUp = true): Card {
    return new Card(suit, value, isFaceUp);
}

// starts a game, then swaps the dealt cards for the given piles so each test controls the board
function setUpGame({ tableau = [], discard = [], draw = [] }: { tableau?: Card[][]; discard?: Card[]; draw?: Card[] }): Solitaire {
    const game = new Solitaire();
    game.newGame();
    game.tableauPiles.forEach((pile, pileIndex) => pile.splice(0, pile.length, ...(tableau[pileIndex] ?? [])));
    game.discardPile.splice(0, game.discardPile.length, ...discard);
    game.drawPile.splice(0, game.drawPile.length, ...draw);
    return game;
}

// a plain copy of everything on the board, for comparing the board before and after
function snapshot(game: Solitaire) {
    const describeCard = (card: Card) => `${card.value}${card.suit}${card.isFaceUp ? '' : ' (face down)'}`;
    return {
        draw: game.drawPile.map(describeCard),
        discard: game.discardPile.map(describeCard),
        tableau: game.tableauPiles.map((pile) => pile.map(describeCard)),
        foundations: game.foundationPiles.map((pile) => pile.value),
    };
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('shuffleArray', () => {
    it('can leave a card where it started', () => {
        // a random value just under 1 always picks the card's own position
        vi.spyOn(Math, 'random').mockReturnValue(0.999);
        const cards = [0, 1, 2, 3, 4];
        shuffleArray(cards);
        expect(cards).toEqual([0, 1, 2, 3, 4]);
    });
});

describe('newGame', () => {
    it('deals seven tableau piles with only the last card of each face up', () => {
        const game = new Solitaire();
        game.newGame();

        expect(game.tableauPiles.map((pile) => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
        game.tableauPiles.forEach((pile) => {
            expect(pile.map((card) => card.isFaceUp)).toEqual(pile.map((_, cardIndex) => cardIndex === pile.length - 1));
        });
        expect(game.drawPile).toHaveLength(24);
        expect(game.drawPile.every((card) => !card.isFaceUp)).toBe(true);

        const allCards = [...game.drawPile, ...game.tableauPiles.flat()].map((card) => `${card.value}${card.suit}`);
        expect(new Set(allCards).size).toBe(52);
    });

    it('deals face down cards again when a game is restarted', () => {
        const game = new Solitaire();
        game.newGame();
        while (game.drawCard()) {
            // draw until every draw pile card has been flipped face up
        }

        game.newGame();
        expect(game.drawPile.every((card) => !card.isFaceUp)).toBe(true);
        game.tableauPiles.forEach((pile) => expect(pile.filter((card) => card.isFaceUp)).toHaveLength(1));
    });

    it('clears the score, move counter and undo history', () => {
        const game = setUpGame({ discard: [card(1, 'HEART')] });
        game.playDiscardPileCardToFoundation();

        game.newGame();
        expect(game.score).toBe(0);
        expect(game.numberOfMoves).toBe(0);
        expect(game.canUndo).toBe(false);
    });
});

describe('moves', () => {
    it('counts drawing a card and turning the discard pile over as moves', () => {
        const game = setUpGame({ draw: [card(5, 'CLUB', false)] });

        expect(game.drawCard()).toBe(true);
        expect(game.drawCard()).toBe(false);
        expect(game.shuffleDiscardPile()).toBe(true);
        expect(snapshot(game).draw).toEqual(['5CLUB (face down)']);
        expect(game.numberOfMoves).toBe(2);
        expect(game.score).toBe(0);
    });

    it('only turns the discard pile over when the draw pile is empty and the discard pile is not', () => {
        const drawPileNotEmpty = setUpGame({ draw: [card(5, 'CLUB', false)], discard: [card(6, 'CLUB')] });
        const bothEmpty = setUpGame({});

        expect(drawPileNotEmpty.shuffleDiscardPile()).toBe(false);
        expect(bothEmpty.shuffleDiscardPile()).toBe(false);
        expect(drawPileNotEmpty.numberOfMoves + bothEmpty.numberOfMoves).toBe(0);
    });

    it('awards points for playing the discard pile to a foundation or a tableau pile', () => {
        const game = setUpGame({ tableau: [[card(3, 'SPADE')]], discard: [card(2, 'HEART'), card(1, 'CLUB')] });

        expect(game.playDiscardPileCardToFoundation()).toBe(true);
        expect(game.score).toBe(SCORE.DISCARD_TO_FOUNDATION);
        expect(game.playDiscardPileCardToTableau(0)).toBe(true);
        expect(game.score).toBe(SCORE.DISCARD_TO_FOUNDATION + SCORE.DISCARD_TO_TABLEAU);
        expect(game.numberOfMoves).toBe(2);
    });

    it('turns over the card underneath when the cards on it are moved away, and awards points', () => {
        const game = setUpGame({ tableau: [[card(9, 'DIAMOND', false), card(7, 'HEART')], [card(8, 'SPADE')]] });

        expect(game.moveTableauCardsToAnotherTableau(0, 1, 1)).toBe(true);
        expect(snapshot(game).tableau.slice(0, 2)).toEqual([['9DIAMOND'], ['8SPADE', '7HEART']]);
        expect(game.score).toBe(SCORE.REVEAL_TABLEAU_CARD);
    });

    it('only lets the last card of a tableau pile go to a foundation', () => {
        const game = setUpGame({ tableau: [[card(3, 'SPADE'), card(2, 'HEART')]], discard: [card(1, 'HEART')] });
        game.playDiscardPileCardToFoundation();

        expect(game.moveTableauCardToFoundation(0, 0)).toBe(false);
        expect(snapshot(game).tableau[0]).toEqual(['3SPADE', '2HEART']);
        expect(game.moveTableauCardToFoundation(0, 1)).toBe(true);
        expect(snapshot(game).tableau[0]).toEqual(['3SPADE']);
    });

    it('takes points off for time played, but never below 0', () => {
        const game = setUpGame({ discard: [card(1, 'HEART')] });
        game.applyTimePenalty();
        expect(game.score).toBe(0);

        game.playDiscardPileCardToFoundation();
        game.applyTimePenalty();
        expect(game.score).toBe(SCORE.DISCARD_TO_FOUNDATION + SCORE.TIME_PENALTY);
    });

    it('does not count or save invalid moves', () => {
        const game = setUpGame({ tableau: [[card(3, 'SPADE')], [card(3, 'HEART')]], discard: [card(5, 'CLUB')] });

        expect(game.moveTableauCardsToAnotherTableau(0, 0, 1)).toBe(false);
        expect(game.playDiscardPileCardToFoundation()).toBe(false);
        expect(game.playDiscardPileCardToTableau(0)).toBe(false);
        expect(game.numberOfMoves).toBe(0);
        expect(game.canUndo).toBe(false);
    });
});

describe('undo', () => {
    it('puts the board back the way it was, including turning a revealed card face down again', () => {
        const game = setUpGame({ tableau: [[card(9, 'DIAMOND', false), card(7, 'HEART')], [card(8, 'SPADE')]] });
        const before = snapshot(game);

        game.moveTableauCardsToAnotherTableau(0, 1, 1);
        expect(game.undo()).toBe(true);
        expect(snapshot(game)).toEqual(before);
    });

    it('undoes every kind of move, one at a time, back to the start', () => {
        const game = setUpGame({
            tableau: [[card(5, 'DIAMOND', false), card(2, 'CLUB')], [card(3, 'HEART')]],
            draw: [card(1, 'CLUB', false), card(4, 'SPADE', false)],
        });
        const moves = [
            () => game.drawCard(),
            () => game.playDiscardPileCardToFoundation(),
            () => game.drawCard(),
            () => game.shuffleDiscardPile(),
            () => game.drawCard(),
            () => game.moveTableauCardToFoundation(0, 1),
            () => game.playDiscardPileCardToTableau(0),
            () => game.moveTableauCardsToAnotherTableau(1, 0, 0),
        ];

        const boardBeforeEachMove = moves.map((move) => {
            const board = snapshot(game);
            expect(move()).toBe(true);
            return board;
        });
        expect(snapshot(game).tableau.slice(0, 2)).toEqual([['5DIAMOND', '4SPADE', '3HEART'], []]);

        boardBeforeEachMove.reverse().forEach((board) => {
            expect(game.undo()).toBe(true);
            expect(snapshot(game)).toEqual(board);
        });
        expect(game.canUndo).toBe(false);
    });

    it('takes back the points the move earned plus the undo cost, and counts as a move', () => {
        const game = setUpGame({ discard: [card(3, 'HEART'), card(2, 'HEART'), card(1, 'HEART')] });
        game.playDiscardPileCardToFoundation();
        game.playDiscardPileCardToFoundation();
        game.playDiscardPileCardToFoundation();

        game.undo();
        expect(game.score).toBe(2 * SCORE.DISCARD_TO_FOUNDATION + SCORE.UNDO);
        expect(game.numberOfMoves).toBe(4);
    });

    it('takes back points for a card the move turned over', () => {
        const game = setUpGame({
            tableau: [[card(9, 'DIAMOND', false), card(7, 'HEART')], [card(8, 'SPADE')]],
            discard: [card(3, 'CLUB'), card(2, 'CLUB'), card(1, 'CLUB')],
        });
        game.playDiscardPileCardToFoundation();
        game.playDiscardPileCardToFoundation();
        game.playDiscardPileCardToFoundation();
        game.moveTableauCardsToAnotherTableau(0, 1, 1);
        expect(game.score).toBe(3 * SCORE.DISCARD_TO_FOUNDATION + SCORE.REVEAL_TABLEAU_CARD);

        game.undo();
        expect(game.score).toBe(3 * SCORE.DISCARD_TO_FOUNDATION + SCORE.UNDO);
    });

    it('does not take the score below 0', () => {
        const game = setUpGame({ discard: [card(1, 'HEART')] });
        game.playDiscardPileCardToFoundation();

        game.undo();
        expect(game.score).toBe(0);
    });

    it('does not refund time penalties taken after the move', () => {
        const game = setUpGame({ discard: [card(3, 'HEART'), card(2, 'HEART'), card(1, 'HEART')] });
        game.playDiscardPileCardToFoundation();
        game.playDiscardPileCardToFoundation();
        game.playDiscardPileCardToFoundation();
        game.applyTimePenalty();

        game.undo();
        expect(game.score).toBe(3 * SCORE.DISCARD_TO_FOUNDATION + SCORE.TIME_PENALTY - SCORE.DISCARD_TO_FOUNDATION + SCORE.UNDO);
    });

    it('does nothing when there is no move to undo', () => {
        const game = setUpGame({});

        expect(game.undo()).toBe(false);
        expect(game.score).toBe(0);
        expect(game.numberOfMoves).toBe(0);
    });
});
