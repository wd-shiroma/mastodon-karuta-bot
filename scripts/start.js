var karuta = require('../lib/game');

process.on('unhandledRejection', console.dir);

karuta.new_game();
