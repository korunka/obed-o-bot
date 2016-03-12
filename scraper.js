'use strict';

const request = require('request');
const cheerio = require('cheerio');
const encoding = require('encoding');
const fs = require('fs');



var zdroje = {
  zalezitost : {
    name   : 'Záležitost',
    url    : 'http://zalezitost-public.pawouk.net/meals.html',
    file   : './mockups/zalezitost.html',
    parser : 'parseZalezitost'
  },
  rebellion  : {
    name   : 'Rebellion',
    url    : 'http://rebellion-zizkov.cz/obedove-menu/',
    file   : './mockups/rebellion.tyden.html',
    //file   : './mockups/rebellion.vikend.html',
    parser : 'parseRebellion'
  },
  polo       : {
    name   : 'Bar Polo',
    url    : 'http://www.barpolo.cz/menu.php',
    file   : './mockups/polo.html',
    parser : 'parsePolo'
  }
};



function Scraper() {
  this.nabidka = {
    zalezitost : {
      nazev     : 'Záležitost',
      web       : 'http://www.zalezitost.cz/denni-nabidka/',
      timestamp : 0,
      polozky   : []
    },
    rebellion  : {
      nazev     : 'Rebellion',
      web       : 'http://www.rebellion-zizkov.cz/obedove-menu/',
      timestamp : 0,
      polozky   : []
    },
    polo       : {
      nazev     : 'Bar Polo',
      web       : 'http://www.barpolo.cz/menu.php',
      timestamp : 0,
      polozky   : []
    }
  };


  this.maxAge = 5000; // 5 sec  #debug
//  this.maxAge = 3600000; // 60 min


}



// ===== VEŘEJNÉ ROZHRANÍ =================================================== //


/**
 * Vrací a ukládá nabídku pro konkrétní restauraci.
 *
 * @param idZdroje
 * @returns {Promise}
 */
Scraper.prototype.vratNabidku = function (idZdroje) {
  var self = this;
  return new Promise(function (resolve, reject) {
    if (!self.nabidka.hasOwnProperty(idZdroje) || self.nabidka[idZdroje].timestamp <= Date.now() - self.maxAge) {
      self.stahniNabidku(idZdroje).then(
        () => resolve(self.nabidka[idZdroje])
      ).catch(
        () => reject('Pro ' + idZdroje + ' se nedaří získat nabídku.')
      );
    } else {
      resolve(self.nabidka[idZdroje]);
    }
  });
};



/**
 * Vrací a ukládá nabídku pro všechny známé restaurace.
 *
 * @returns {Promise}
 */
Scraper.prototype.vratVsechnyNabidky = function () {
  var self = this;
  var promiseQueue = Object.keys(zdroje).map(self.vratNabidku, self);

  return new Promise(function (resolve) {
    var lastPromise = Promise.resolve();
    var resolveWithCurentNabidka = () => resolve(self.nabidka);
    var handleCatchedRejection = (error) => console.log(error); // TODO: Use logging middleware

    for (let i = 0; i <= promiseQueue.length; i++) {
      if (i < promiseQueue.length) {
        // take last promise and chain another one to it, which now becomes
        // the "last promise" in the chain
        lastPromise = lastPromise
          .then(() => promiseQueue[i]) // TODO: mark responses with zero results
          .catch(handleCatchedRejection);
        // ".then().catch()" to make sure all promises in the chain are tried
      } else {
        lastPromise.then(resolveWithCurentNabidka);
      }
    }
  });
};



// ===== WORKERS ============================================================ //


/**
 * Metoda starající se o stahování dat z určitého zdroje.
 *
 * Pokud je nastavená ENV proměnná OFFLINE_NABIDKA, pak načítá nabídku z
 * testovacího souboru na disku, podle zdroje.
 *
 * @param idZdroje
 * @returns {Promise}
 */
Scraper.prototype.stahniNabidku = function (idZdroje) {
  var self = this;

  return new Promise(function (resolve, reject) {
    var zpracujZiskanouNabidku = function (err, body) {
      if (err) {
        reject('nepodařilo se stáhnout nabídku pro ' + zdroje[idZdroje].name, err);
      } else {
        self[zdroje[idZdroje].parser](body, idZdroje);
        resolve(self.nabidka[idZdroje]);
      }
    };
    if (process.env.OFFLINE_NABIDKA == 'TRUE') {
      fs.readFile(
        zdroje[idZdroje].file,
        (err, body) => zpracujZiskanouNabidku(err, body)
      );
    } else {
      request(
        { url : zdroje[idZdroje].url, encoding : null },
        (err, resp, body) => zpracujZiskanouNabidku(err, body)
      );
    }
  });
};



// ===== PARSERY DAT Z WEBŮ RESTAURACÍ ====================================== //


/**
 * Parsuje HTML nabídky ze Záležitosti.
 *
 * @param {Buffer} buffer
 * @param {String} mojeId
 */
Scraper.prototype.parseZalezitost = function (buffer, mojeId) {
  var body = encoding.convert(buffer, 'UTF-8', 'cp1250');
  var $ = cheerio.load(body);
  var nabidkaZalezitosti = [];

  $('#content table tr').each(function (idx, el) {
    var nazev = $(el).children('td.meals-content').text();
    var cena = $(el).children('td[align=right]').text();

    // pokud není nabídka, tak smůla
    if (nazev.match(/nabídka pro tento den se připravuje/i)) {
      return false; // break
    }
    // pokud je to separátor, tak to nechceme
    if (nazev.match(/-{5,}/)) {
      return true; // continue
    }
    nabidkaZalezitosti.push({
      nazev : nazev.replace(/\s+/g, ' ')
        .replace(/\([\s123456789,]+\)\s?$/i, '')
        .replace(/^\d\)/i, '')
        .trim(),
      cena  : cena.replace(/,-\s/g, ' ').trim()
    });
  });

  this.nabidka[mojeId]['timestamp'] = Date.now();
  this.nabidka[mojeId]['polozky'] = nabidkaZalezitosti;
};



/**
 * Parsuje HTML nabídky z Rebellionu.
 *
 * @param {Buffer} buffer
 * @param {String} mojeId
 */
Scraper.prototype.parseRebellion = function (buffer, mojeId) {
  var body = encoding.convert(buffer, 'UTF-8');
  var $ = cheerio.load(body);
  var nabidkaRebe = [];

  var ceskeDny = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  var den = ceskeDny[new Date().getDay()];

  $('.tmi-group-name>span').each(function (idx, el) {

    // Jídlo z jiných dní než dneška nechceme.
    if ($(el).text().toLowerCase() !== den) {
      return true; // continue
    }

    // uložíme si všechna jednotlivá jídla pro daný den
    $(el).parent().nextAll('.tmi-daily').each(function (idx, el) {
      let dirtyNazev = $(el).find('.tmi-name').text();
      let dirtyCena = $(el).find('.tmi-price').text();
      nabidkaRebe.push({
        nazev : dirtyNazev.replace(/\s+/g, ' ').trim().replace(/^\d\)/i, '').trim(),
        cena  : dirtyCena.replace(/\s+/g, ' ').trim()
      });
    });

  });

  this.nabidka[mojeId]['timestamp'] = Date.now();
  this.nabidka[mojeId]['polozky'] = nabidkaRebe;
};



/**
 * Parsuje HTML nabídky z Baru Polo.
 *
 * @param {Buffer} buffer
 * @param {String} mojeId
 */
Scraper.prototype.parsePolo = function (buffer, mojeId) {
  var body = encoding.convert(buffer, 'UTF-8');
  var $ = cheerio.load(body);
  var nabidkaPola = [];
  $('table.tab_nabidka tr').each(function (idx, el) {
    if ($(el).find('td[colspan=3]').length > 0) {
      // pokud je to nadpis, tak ho přeskočíme
      return true; // continue
    } else {
      let tds = $(el).children('td').toArray();
      if ($(tds[1]).text().match(/informace\so\salergenech/i)) {
        // pokud je to závěrčné upozornění na alergeny, tak končíme
        return false;
      }
      let vaha = $(tds[0]).text().replace(/\s/g, '').trim();
      let nazev = $(tds[1]).text().replace(/\s+/g, ' ').trim();
      let cena = $(tds[2]).text();
      nabidkaPola.push({
        nazev : vaha + ' ' + nazev,
        cena  : cena.trim()
      });
    }
  });
  this.nabidka[mojeId]['timestamp'] = Date.now();
  this.nabidka[mojeId]['polozky'] = nabidkaPola;
};


module.exports = Scraper;

