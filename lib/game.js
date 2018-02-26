var Mastodon = require('mstdn-api').default;
var WebSocket = require('ws');
var config = require('config');
var db = require('./db');
var msg = require('./decorator');
var KarutaDeck = require('./karuta');

var stream;
var game_id;
var card_id;
var karuta = new KarutaDeck();
var timeout_id;
var veify_credentials;

var actions = {};

var bot;

var init_process = async function() {
    try {
        bot = new Mastodon(config.access_token, config.domain);
    } catch(e) {
        console.log(e);
        process.exit(1);
    }
    verify_credentials = await bot.get('accounts/verify_credentials');
}

var start_streaming = async function() {
    var status = '『' + karuta.next_card().upper_phrase + '。。。』';
    await bot.post('statuses', { status: status });
    connect_stream();

    timeout_id = setTimeout(timeover, config.responsive);
};

var connect_stream = function() {
    var deck = karuta.deck();
    var url = 'wss://' + config.domain + '/api/v1/streaming/?access_token='
            + config.access_token + '&stream=user';
    stream = new WebSocket(url);

    stream.onerror = function(error) {
        console.log('error!');
        console.log(error.toString());
        setTimeout(connect_stream, 1000);
    };

    stream.onmessage = async function(message) {
        var data = JSON.parse(message.data);

        if (data.event !== 'update') return;
        var payload = JSON.parse(data.payload);

        if (payload.account.acct === verify_credentials.acct) return;

        var judge = karuta.judge_status(payload.content);
        if (judge < 0) return;

        var player = await db.get_player_statement(payload.account.acct);
        if (player && !karuta.is_correct(player.judge)) {
            var status = '@' + payload.account.acct + ' さん、お手付きで一回休み中です！\n\n'
                + '\n\n残り札数：' + ( deck.length ) + '枚';
            bot.post('statuses', { status: status });
            return;
        }

        var score;
        var status;
        if(karuta.is_correct(judge)) {
            if (timeout_id) {
                clearTimeout(timeout_id);
                timeout_id = 0;
            }
            status = '@' + payload.account.acct + ' さんが札を取りました！ \n\n'
                + karuta.make_phrase();
            score = 1;
            stop_streaming();
        }
        else {
            var status = '@' + payload.account.acct + ' さん、お手付きです。。。\n次の札は取れません。。。'
                + '\n\n残り札数：' + ( deck.length ) + '枚';
            bot.post('statuses', { status: status });
            score = 0;
        }
        db.insert_player_log({
            $acct: payload.account.acct,
            $score: score,
            $source: payload.url,
            $judge: judge
        });

        if (score === 1 && deck.length === 2) {
            await db.next_card(deck.find(c => c.initial !== karuta.judged_initial).initial, false);
            await db.insert_player_log({
                $acct: payload.account.acct,
                $score: 1,
                $source: payload.url,
                $judge: 0
            });
            status += '\n\n最後の札も併せて取得となります。';
        }
        else {
            status += '\n\n残り札数：' + ( deck.length - 1 ) + '枚';
        }
        bot.post('statuses', { status: status });
    };
    stream.onclose = function() {
        console.log('closed streaming...');
    };
};

var stop_streaming = async function() {
    if (stream) {
        stream.close();
        stream = null;
    }
    await actions.start();
};

var timeover = async function() {
    var status = '時間切れです。。。\n\n残り札数：' + ( karuta.deck().length - 1 ) + '枚';
    await bot.post('statuses', { status: status });
    await stop_streaming();
};

var regist_next_card = async function(cards = []) {
    karuta.set_cards(cards);

    var latest_players_log = await db.get_player_statement();
    await db.next_card(karuta.next_card().initial, config.rules.dummy_card);
    latest_players_log.filter( p => !karuta.is_correct(p.judge) ).forEach(async function(e) {
        await db.insert_player_log({
            $acct: e.acct,
            $score: 0,
            $source: e.source,
            $judge: karuta.toggle_judge(e.judge)
        });
    });

    var timeout = Math.floor(Math.random() * (config.interval_max - config.interval_min) + config.interval_min);
    setTimeout(start_streaming, timeout);
}

var post_prelude = async function() {
    var prelude = karuta.prelude_card();
    var phrase = karuta.make_phrase(prelude);
    var status = config.title + 'を開始します。\n' + phrase + '\n' + phrase;

    await bot.post('statuses', { status: status });
}

var exit_game = async function() {
    var player_log = await db.latest_player_log();
    var initials_per_player = {};
    for (var i = 0; i < player_log.length; i++) {
        initials_per_player[player_log[i].acct] = initials_per_player[player_log[i].acct] || [];
        if (player_log[i].judge === 0)
            initials_per_player[player_log[i].acct].push(player_log[i].initial);
    }

    var player_initials = [];
    for (var i in initials_per_player) {
        player_initials.push({
            acct: i,
            initials: initials_per_player[i].sort()
        });
    }

    karuta.meta.bonus_cards.forEach(function(b) {
        player_initials.filter(
            p => b.initials.every(bi => p.initials.includes(bi))
        ).forEach( function(p) {
            db.insert_player_log({
                $acct: p.acct,
                $source: b.name,
                $score: b.score,
                $judge: 3
            });
        });
    });

    var status = '競技終了！\n\n🎊 結果発表 🎊'

    var score = await db.latest_player_score();
    if (score.length) {
        for (var i = 0; i < score.length && i < 3; i++) {
            status += '\n' + (i+1) + '位 @' + score[i].acct + ' : ' + score[i].total_score + '点';
        }
    }
    else {
        status += '\n誰も札を取りませんでした。。。';
    }

    var bonus = await db.latest_player_bonus();
    if (bonus.length) {
        status += '\n\n🎉 役札がそろいました！ 🎉';
        for (var i = 0; i < bonus.length; i++) {
            var bonus_data = karuta.get_bonus_data(bonus[i].source);
            status += '\n「' + bonus_data.name + '」(+' + bonus_data.score + ') @' + bonus[i].acct;
        }
    }
    bot.post('statuses', { status: status, visibility: 'public' });
    actions.new_game();
};

actions.new_game = async function() {
    var game_id = await db.next_game();
    msg.info('New game was registed.');
    msg.plane('current game ID: ' + game_id);

    var now = new Date();
    var next_time = new Date(now.toLocaleDateString() + ' ' + config.start_time);
    if (now.getTime() > next_time.getTime()) {
        next_time.setDate(next_time.getDate() + 1);
    }
    setTimeout(actions.start, next_time.getTime() - now.getTime());
}

actions.start = async function() {
    var latest_cards = await db.latest_cards();
    if (latest_cards.length === 0) {
        post_prelude();
        regist_next_card(latest_cards);
    }
    else if (latest_cards.length < karuta.meta.cards.length - 1) {
        game_id = latest_cards[0].game_id;
        card_id = latest_cards[0].id
        regist_next_card(latest_cards);
    }
    else {
        setTimeout(exit_game, 5000);
    }
};

init_process();

module.exports = actions;
