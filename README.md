# Mastodon Karuta bot

This is a bot to play Karuta on Mastodon's local timeline.

マストドンのローカルタイムラインでかるたをするためのbotです。  
このbotは「上毛かるた」のルールに基づいて作られています。

## Features

- Periodical execution of streaming. 
- Posting Karuta's upper phrase and monitoring Karuta's lower phrase.
- Examine special combination cards.

## Requirement

- Node.js (> 9.0.0)
- node-gyp

## Usage

```script
# download bot
git clone https://github.com/wd-shiroma/mastodon-karuta-bot.git

cd mastodon-karuta-bot

# install requires packages
npm install -g node-gyp
npm install

# setup your environment
cp config/default.json.sample config/default.json
vim config/default.json

# test your environment
npm test

# initialize database
npm run init

# execute bot
npm start

# status executing bot
npm run list

# stop bot
npm stop
```

## Configuration

```json
{
    "domain": "example.com",
    "access_token": "YOUR ACCESS TOKEN",
    "delay": 5000,
    "start_time": "12:00:00",
    "interval_max": 43200000,
    "interval_min": 1800000,
    "responsive": 10800000,
    "title": "上毛かるた",
    "rules": {
        "dummy_card": true,
        "touching_a_wrong_card": true,
        "touching_multiple_cards": true
    }
}
```

- domain: インスタンスのドメイン
- access_token: botのアクセストークン
- delay: トゥートの遅延時間
- start_time: 競技開始時刻(0:00:00-23:59:59)
- interval_max: 次の札読み上げまでの最大時間
- interval_min: 次の札読み上げまでの最小時間
- responsive: ストリーミング受付時間(札を取る制限時間)
- title: 競技名
- rules.dummy\_card: 最後の2枚の空札
- rules.touching\_a\_wrong\_card: お手付き
- rules.touching\_multiple\_cards: お手付き(複数枚)