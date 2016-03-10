'use strict';

require('dotenv').load();
const Scraper = require('./scraper');

if (!process.env.SLACK_API_TOKEN) {
  console.log('Error: Specify slack token in environment');
  process.exit(1);
}

var scraper = new Scraper(); // stačí nám jeden



var Botkit = require('botkit/lib/Botkit.js');

var controller = Botkit.slackbot({
  debug : process.env.SLACKBOT_DEBUG
});

controller.spawn({
  token : process.env.SLACK_API_TOKEN
}).startRTM();



/**
 * Generátor nádodných čísel od MIN do MAX (vyjma MAX)
 *
 * @param {Number} min
 * @param {Number} max
 * @returns {Number}
 */
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}



// ========================================================================== //
// ===== ZÁKLADNÍ KOMUNIKACE
// ========================================================================== //

controller.hears(
  ['^ob[eě]d\\?)*'],
  ['ambient'],
  function (bot, message) {
    bot.api.reactions.add({
        timestamp : message.ts,
        channel   : message.channel,
        name      : 'robot_face'
      },
      function (err) {
        if (err) {
          bot.botkit.log('Failed to add emoji reaction :( ', err);
        }
      });

    bot.reply(message, 'Moje řeč. Čas na oběd!');
  }
);
controller.hears(
  ['[cč]au', '[čc]us', 'ahoj', 'zdar'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    let odpovedi = [
      'Čau', 'Čus', 'Ahoj', 'Zdar', 'Čau. Jak se vede?',
      'Jé čau. Ani jsem tě neviděl přicházet.',
      'Buď zdráv, sou... ehm... kamaráde.'
    ];
    bot.reply(message, odpovedi[getRandomInt(0, odpovedi.length)]);
  }
);



// ========================================================================== //
// ===== CO HRAJOU v Rebe/Zale/Polo
// ========================================================================== //


controller.hears(
  ['(?=co.*(?=hraj|maj|d[aá]va|je)).*(z[aá]le|rebe|p[oó]l[ou])'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    var hit = message.match[1];
    var idZdroje;

    // pošleme aktivitu
    bot.reply(message, { type : 'typing' });

    if (hit.search(/z[aá]le/i) > -1) {
      idZdroje = 'zalezitost';
    } else if (hit.search(/rebe/i) > -1) {
      idZdroje = 'rebellion';
    } else if (hit.search(/p[oó]l[ou]/i) > -1) {
      idZdroje = 'polo';
    }

    scraper.vratNabidku(idZdroje).then(function (result) {
      if (result.polozky.length === 0) {
        bot.reply(message, 'Pro ' + result.nazev + ' dnes nemám žádnou nabídku.');
      } else {
        var polozky = [];
        for (var i = 0; i < result.polozky.length; i++) {
          polozky.push(
            result.polozky[i].nazev + ' - *' + result.polozky[i].cena + '*'
          );
        }
        bot.reply(message, {
          text        : 'Aktuální nabídka pro ' + result.nazev,
          attachments : [{
            fallback   : 'Denní menu pro ' + result.nazev + ': ' + result.web,
            title      : result.nazev,
            title_link : result.web,
            text       : polozky.join('\n'),
            mrkdwn_in  : ['text']
          }]
        });
      }
    }).catch(() => bot.reply(message, 'Promiň, něco se pokazilo a nemůžu najít nabídku.'));
  }
);

controller.hears(
  ['(co.*(hraj|maj|d[aá]va|je))(?!.*(z[aá]le|rebe|p[oó]l[ou]))', 'jaká.*nab[ií]d'],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    // pošleme aktivitu
    bot.reply(message, { type : 'typing' });
    scraper.vratVsechnyNabidky().then(function (results) {

      if (Object.keys(results).length === 0) {
        bot.reply(message, 'Bohužel pro dnešek nemám žádné nabídky.');
      } else {
        var nabidky = [];
        for (var key in results) {
          if (results.hasOwnProperty(key)) {
            var polozky = [];
            for (var i = 0; i < results[key].polozky.length; i++) {
              polozky.push(
                results[key].polozky[i].nazev + ' - *' + results[key].polozky[i].cena + '*'
              );
            }
            nabidky.push({
              fallback   : 'Denní menu pro ' + results[key].nazev + ': ' + results[key].web,
              title      : results[key].nazev,
              title_link : results[key].web,
              text       : polozky.join('\n'),
              mrkdwn_in  : ['text']
            });
          }
        }
        bot.reply(message, {
          text        : 'Takhle vypadá aktuální nabídka',
          attachments : nabidky
        });
      }
    }).catch((error) => console.log('Error:', error));
  }
);

