var sqlite3 = require('sqlite3');
var flake = require('simpleflake');

var db = new sqlite3.Database('./db.sql');

var actions = {};

var create_id = function() {
    return flake().toString('base10');
};

var parse_id = function(id) {
    return flake.parse(id, 'base10');
};

actions.init = function() {
    db.serialize(function() {
        db.run('create table card (id integer primary key, game_id integer, initial text, dummy integer)');
        db.run('create table player_log (id integer primary key, game_id integer, card_id integer, acct text, score integer, source text, judge integer)');
        db.run('create table game (id integer primary key)');
        actions.next_game();
    });
};

actions.next_game = function() {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            var id = create_id();
            db.run(
                'insert into game values ( ? )',
                [ id ],
                function(err) {
                    if (err) reject(err);
                    else resolve(id);
                }
            );
        });
    });
};

actions.next_card = function(initial, dummy = false) {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            var id = create_id();
            db.run('insert into card values ( ?, (select id from game order by id desc limit 1), ?, ? )',
                [ id, initial, dummy ? 1 : 0 ],
                function(err) {
                    if (err) reject(err);
                    else resolve(id);
                }
            );
        });
    });
};

actions.insert_player_log = function(keys = {}) {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            var id = create_id();
            db.run('insert into player_log (id, game_id, card_id, acct, score, source, judge) values ( ' + id + ', (select id from game order by id desc limit 1), (select id from card order by id desc limit 1), $acct, $score, $source, $judge )',
                keys,
                function(err) {
                    if (err) reject(err);
                    else (resolve(id))
                }
            );
        });
    });
};

actions.latest_cards = function(dummy = true) {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            db.all('select * from card where game_id = (select id from game order by id desc limit 1)'
                    + (dummy ? '' : ' and dummy = 0') + ' order by id desc',
                function(err, rows) {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    });
};

actions.latest_player_log = function() {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            var sql = 'select * from player_log left outer join card on player_log.card_id = card.id where player_log.game_id = (select id from game order by id desc limit 1)';
            db.all(sql,
                function(err, rows) {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    });
};

actions.latest_player_score = function() {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            db.all('select *, sum(score) as total_score from player_log where game_id = (select id from game order by id desc limit 1) group by acct order by total_score desc',
                function(err, rows) {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    });
};

actions.latest_player_bonus = function() {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            db.all('select * from player_log where game_id = (select id from game order by id desc limit 1) and judge = 3',
                function(err, rows) {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    });
}

actions.get_player_statement = function(acct = false) {
    return new Promise(function(resolve, reject) {
        db.serialize(function() {
            var sql = 'select * from player_log where card_id = (select id from card order by id desc limit 1)'
                    + (acct ? (' and acct = \'' + acct + '\'') : '');
            if (acct) {
                db.get(sql,
                function(err, row) {
                    if (err) reject(err);
                    else resolve(row);
                });
            }
            else {
                db.all(sql,
                function(err, rows) {
                    if (err) reject(err);
                    else resolve(rows);
                });
            }
        });
    });
};

module.exports = actions;
