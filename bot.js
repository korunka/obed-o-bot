'use strict';

require('dotenv').load();
const Scraper = require('./scraper');
const Chance = require('chance');

if (!process.env.SLACK_API_TOKEN) {
  console.log('Error: Specify slack token in environment');
  process.exit(1);
}

var scraper = new Scraper(); // stačí nám jeden
const chance = new Chance();



var Botkit = require('botkit/lib/Botkit.js');

var controller = Botkit.slackbot({
  debug : process.env.SLACKBOT_DEBUG == 'TRUE'
});

controller.spawn({
  token : process.env.SLACK_API_TOKEN
}).startRTM();



// ========================================================================== //
// ===== ZÁKLADNÍ KOMUNIKACE
// ========================================================================== //

controller.hears(
  ['^ob[eě]d(\\?)*'],
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
    bot.reply(message, odpovedi[chance.natural({
      min : 0,
      max : odpovedi.length - 1
    })]);
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



// ========================================================================== //
// ===== KAM PŮJDEME? - HLASOVÁNÍ
// ========================================================================== //


controller.hears(
  [
    '(kam)',                // KAM půjdeme
    '(kter)(?!.*j[ií]dl)'   // KTERou vybereme, ale už ne "které jídlo si dáte"
  ],
  ['direct_message', 'direct_mention', 'mention', 'ambient'],
  function (bot, message) {
    // pošleme aktivitu
    bot.reply(message, { type : 'typing' });
    // pro všechny restauračky, kde máme nabídku jídel připravíme hlasování
    scraper.vratVsechnyNabidky()
      .then(function (results) {
        if (Object.keys(results).length === 0) {
          bot.reply(message, 'Dneska vám asi nic nedoporučím. Nemám z čeho.');
        } else {
          var restaurace = { fallback : [], text : [] };
          var i = 0;
          var emojis = [':one:', ':two:', ':three:', ':four:', ':five:']; // zatím víc než 5 neumíme

          for (var key in results) {
            if (results.hasOwnProperty(key)) {

              // TODO: neumíme víc než pět emoticon, zatím...
              if (i >= 5) {
                bot.say(
                  message,
                  'Hmm... mám nějak víc možností než co zvládám. ' +
                  'Kouknul byste se mi pak někdo pod kapotu?'
                );
                break;
              }

              // připravíme si data pro zprávu
              if (results[key].polozky.length > 0) {
                restaurace.text.push(emojis[i] + ' ' + results[key].nazev);
                restaurace.fallback.push('(' + ++i + ') ' + results[key].nazev);
              }

            }
          }

          bot.reply(message, {
              text        : 'Vyberte, kde všude si dneska vyberete. (reakcemi pod příspěvkem)',
              attachments : [{
                fallback  : restaurace.fallback.join(' | '),
                color     : 'good',
                text      : restaurace.text.join('\n'),
                mrkdwn_in : ['text']
              }]
            }, function (error, json) {
              if (!error) {
                var j = 0;
                do {
                  bot.api.reactions.add(
                    {
                      timestamp : json.ts,
                      channel   : json.channel,
                      name      : emojis[j].replace(/:/gi, '')
                    },
                    function (err) {
                      if (err) {
                        bot.botkit.log('Failed to add emoji reaction ' + emojis[j], err);
                      }
                    }
                  );
                } while (++j < i);
              }
            }
          );
        }
      })
      .catch(function (err) {
          console.log(err);
          let messages = [
            'jsem teď trochu zmatený',
            'zamotaly se mi optický kabely',
            'Šifty říkal, že vyhrála Záležitost',
            'něco mi hapruje pod kapotou'
          ];
          bot.reply(
            message,
            'Chtěl jsem vám udělat hlasování, ale '
            + messages[chance.natural({
              min : 0,
              max : messages.length - 1
            })] + '.'
          );
        }
      );
  }
);

