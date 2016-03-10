# Oběd-o-bot

Bot pro [Slack](https://slack.com "Woohoo... Slack... Korunka is cool, bro!"),
který kontroluje obědovou nabídku v okolí
[Korunky](https://www.korunka.eu/ "Loterie Korunka") a na dotaz ji prezentuje
v kanáu #obed nebo osobní konverzaci.

Technologie: [Node.js](https://github.com/nodejs/node) + [Slack](https://slack.com)

[![Dependency Status](https://david-dm.org/korunka/obed-o-bot.svg)](https://david-dm.org/korunka/obed-o-bot) [![Code Climate](https://codeclimate.com/github/korunka/obed-o-bot/badges/gpa.svg)](https://codeclimate.com/github/korunka/obed-o-bot) [![Codacy Badge](https://api.codacy.com/project/badge/grade/22ceb27921eb48c7a63187963d559b2c)](https://www.codacy.com/app/ondra/obed-o-bot) [![Korunka badge](https://img.shields.io/badge/powered%20by-Loterie%20Korunka-edbf1f.svg)](https://www.korunka.eu/)



## Getting Started

1. Získejte `SLACK_API_TOKEN` pro BOTA
      1. Vytvořte novou [bot integration](https://my.slack.com/services/new/bot) (pokud ještě BOTA nemáte)
      2. Uložte si `SLACK_API_TOKEN` ze stránky pro úpravu BOTA ([Custom integrations](https://korunka.slack.com/apps/manage/custom-integrations) > Bots > :pencil2: Edit configuration)
2. `git clone & npm install` na serveru nebo lokálně
3. do `.env` vložte `SLACK_API_TOKEN=rofl-01234567890-TokenCoVámVystavilSlack`
4. `npm start`
5. pozvěte `@<jmeno-vaseho-bota>` do nějakého kanálu nebo otevřete přímou konverzaci
6. a pak už jen... `nevíte někdo co mají dnes v záležitosti?`



## Demo

![Ukázka, jak funguje Oběd-o-bot](https://files.slack.com/files-pri/T0Q92HGF6-F0QMGDN68/obedobot-demo.jpg?pub_secret=3a4a8458ba)



## Road ahead

Nová funkcionalita a změny, které by se do budoucna hodily:

- [ ] Restaurace jako pluginy do Scraperu
- [ ] Lepší architektura akcí a reakcí - místo aktuálního špageťáku v `bot.js`
- [ ] Vylepšení interakce bota s kanály - například oznámí, když přijde nebo když odchází (spadne)
- [ ] Testy pro Scraper
- [ ] Testy pro interakce: hear(x) → say(y)



## Dependencies
 * [Botkit](https://github.com/howdyai/botkit) - skvělá knihovna pro Slack
 * [Cheerio](https://github.com/cheeriojs/cheerio) pro scrapeování webových
   stránek pomocí CSS selektorů. Uplně stejně jako jQuery.
 * [Dotenv](https://github.com/motdotla/dotenv) poskytuje `process.env` proměnné
   načtené z lokálního `.env` souboru.
 * [Encoding](https://github.com/andris9/encoding) protože některé restaurace
   mají potřebu posílat nabídku v kódování `cp1250` :-)



## Licence

Powered by [Loterie Korunka](https://www.korunka.eu) &copy;2016.
Code licensed under an [ISC License](https://github.com/korunka/obed-o-bot/blob/master/LICENSE).

Made with :yellow_heart: in Prague
