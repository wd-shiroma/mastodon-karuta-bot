var Mastodon = require('mstdn-api').default;
var msg = require('../lib/decorator');

var error_process = function(e, text = '') {
    msg.error('NG');
    if (text) msg.warning(text);
    console.log(e);
    process.exit(0);
}

var check_authorization = function(conf) {
    var bot;
    try {
        bot = new Mastodon(conf.access_token, conf.domain);
    } catch(e) {
        error_process(e, 'Creating bot object failed');
    }

    return new Promise(function(resolve, reject) {
        bot.get('accounts/verify_credentials')
        .then(function(data) {
            msg
                .info('OK')
                .plane('Authorized account is: ' + data.acct + '@' + conf.domain);
            resolve(data);
        }, function(err) {
            msg.error('NG');
            if (err.response) {
                msg
                    .plane('Status code: ', false).error(err.response.statusCode.toString())
                    .plane('Response body: ', false).error(JSON.stringify(err.response.body));
            } else {
                console.log(err);
            }
            reject(err);
        })
    });
};

msg.plane('Testing Karuta BOT environments').plane().plane('Loading configuration ... ', false);

try {
    var config = require('config');
} catch(e) {
    error_process(e, 'Loading failed.')
}

msg.info('OK').plane('Loading card configuration ... ', false);

try {
    var cards = require('../config/karuta.json');
} catch(e) {
    error_process(e, 'Loading failed.')
}

msg.info('OK').plane('Authorizing bot account ... ', false);

check_authorization(config)
.then(function() {
    msg.plane('\nAll tests was completed!');
    process.exit(0);
}, function(e) {
    process.exit(1);
});
