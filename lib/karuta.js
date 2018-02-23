const JUDGE_INVALID   = -1;
const JUDGE_CORRECT   =  0;
const JUDGE_INCORRECT =  1;
const JUDGE_MULTIPLE  =  2;
const JUDGE_BONUS     =  3;
const JUDGE_CANCEL    =  4;

class Karuta {

    constructor(read = []) {
        this.meta = require('../config/karuta.json');
        this.read = read;
        this.initials = [];
        this.next = {};
        this.is_dummy = false;
        this.judged_initial = '';
    }

    prelude_card() {
        return this.meta.cards.find(
            c => c.initial === this.meta.prelude_card.initial
        );
    }

    deck() {
        return this.meta.cards.filter(
            c => !this.read.some( r => r.initial === c.initial )
        );
    }

    initials() {
        return this.meta.read.map( e => e.initial );
    }

    set_cards(read, dummy = false) {
        this.read = read;
        var deck = this.deck();
        if (deck.length === 2 && dummy) {
            this.is_dummy = (Math.random() > 0.7);
        }
        if (this.is_dummy) {
            var initials = this.initials();
            var next = Math.floor(Math.random() * initials.length);
            this.next = this.meta.cards.find(c => c.initials === initials[next]);
        }
        else {
            this.next_index = Math.floor(Math.random() * deck.length);
        }
    }

    next_card() {
        return this.deck()[this.next_index];
    }

    make_phrase(card = false) {
        card = card || this.next_card();
        return '『' + card.upper_phrase + ' ' + card.lower_phrase + '』。。。';
    }

    judge_status (status) {
        var initials = this.deck().filter(function(c) {
            var re = new RegExp(c.regexp);
            return status.match(re) ? true : false;
        }).map(c => c.initial);

        this.judged_initial = '';

        if (initials.length === 0) {
            return JUDGE_INVALID;
        }
        else if (initials.length === 1) {
            if (initials[0] === this.next_card().initial && !this.is_dummy) {
                this.judged_initial = initials[0];
                return JUDGE_CORRECT;
            }
            else {
                return JUDGE_INCORRECT;
            }
        }
        else {
            return JUDGE_MULTIPLE;
        }
    }

    get_bonus_data(name = undefined) {
        if (name) {
            return this.meta.bonus_cards.find(e => e.name === name);
        }
        else {
            return this.meta.bonus_cards;
        }
    }

    is_correct(judge) {
        switch (judge) {
            case JUDGE_INCORRECT:
            case JUDGE_MULTIPLE:
            case JUDGE_CANCEL:
                return false;
            default:
                return true;
        }
    }

    toggle_judge(judge) {
        switch (judge) {
            case JUDGE_INCORRECT:
            case JUDGE_MULTIPLE:
                return JUDGE_CANCEL;
            case JUDGE_CANCEL:
            default:
                return JUDGE_CORRECT;
        }
    }
}

module.exports = Karuta;

