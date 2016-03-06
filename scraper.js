"use strict"

const request = require('request');
const cheerio = require('cheerio');
const encoding = require('encoding');
const fs = require('fs');


// testujeme ze souborů?
const offline = false;



var zdroje = {
  "zalezitost" : {
    "name"   : "Záležitost",
    "url"    : "http://zalezitost-public.pawouk.net/meals.html",
    "file"   : "./mockups/zalezitost.html",
    "parser" : "parseZalezitost"
  },
  "rebellion"  : {
    "name"   : "Rebellion",
    "url"    : "http://rebellion-zizkov.cz/obedove-menu/",
    "file"   : "./mockups/rebellion.tyden.html",
    //"file"   : "./mockups/rebellion.vikend.html",
    "parser" : "parseRebellion"
  },
  "polo"       : {
    "name"   : "Bar Polo",
    "url"    : "http://www.barpolo.cz/menu.php",
    "file"   : "./mockups/polo.html",
    "parser" : "parsePolo"
  }
};



function Scraper() {
  this.nabidka = {
    "zalezitost" : {
      "nazev"     : "Záležitost",
      "web"       : 'http://www.zalezitost.cz/denni-nabidka/',
      "timestamp" : 123456,
      "polozky"   : [
        { nazev : "...", cena : "xxx Kč" }
      ]
    },
    "rebellion"  : {
      "nazev"     : "Rebellion",
      "web"       : 'http://www.rebellion-zizkov.cz/obedove-menu/',
      "timestamp" : 123456,
      "polozky"   : [
        { nazev : "...", cena : "xxx Kč" }
      ]
    },
    "polo"       : {
      "nazev"     : "Bar Polo",
      "web"       : 'http://www.barpolo.cz/menu.php',
      "timestamp" : 123456,
      "polozky"   : [
        { nazev : "...", cena : "xxx Kč" }
      ]
    }
  };


  this.maxAge = 300000; // 5 min  #debug
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
  var ids = Object.keys(zdroje);
  var promiseQueue = ids.map(self.vratNabidku, self);

  return new Promise(function (resolve, reject) {
    var lastPromise = Promise.resolve();
    for (var i = 0; i <= promiseQueue.length; i++) {
      let idx = i;
      if (i < promiseQueue.length) {
        // take last promise and chain another one to it.
        // That now becomes tha last promise.
        lastPromise = lastPromise.then(() => promiseQueue[idx]).catch(() => {
        });
        // ".then().catch()" to make sure all promises in the chain are tried
      } else {
        lastPromise.then(() => resolve(self.nabidka));
      }
    }
  });
};



// ===== WORKERS ============================================================ //


/**
 * Metoda starající se o stahování dat z určitého zdroje.
 *
 * @param idZdroje
 * @returns {Promise} OKOK
 */
Scraper.prototype.stahniNabidku = function (idZdroje) {
  var self = this;

  if (offline) {
    return self.nactiNabidkuZeSouboru(idZdroje);
  }

  return new Promise(function (resolve, reject) {
    request({
        url      : zdroje[idZdroje].url,
        encoding : null
      },
      function (error, response, body) {

        let mojeId = idZdroje;
        let mujZdroj = zdroje[idZdroje];

        if (error) {
          reject('nepodařilo se stáhnout nabídku pro ' + mujZdroj.name, error);
          console.log('Scraper:', 'nepodařilo se stáhnout nabídku pro ' + mujZdroj.name, error);
        } else {
          self[mujZdroj.parser].apply(self, [body, mojeId]);
          if (self.nabidka[mojeId].polozky.length === 0) {
            console.log('Scraper:', 'nepodařilo se zpracovat nabídku pro ' + mujZdroj.name);
          }
          resolve(self.nabidka[mojeId]);
        }
      }
    );
  });
};



/**
 * Načítá nabídku z testovacího souboru na disku, podle zdroje.
 *
 * @param idZdroje
 * @returns {Promise} OKOK
 */
Scraper.prototype.nactiNabidkuZeSouboru = function (idZdroje) {
  var self = this;

  return new Promise(function (resolve, reject) {

    fs.readFile(
      zdroje[idZdroje].file,
      function (error, body) {
        let mojeId = idZdroje;
        let mujZdroj = zdroje[idZdroje];
        if (error) {
          reject('nepodařilo se načíst soubor s nabídkou pro ' + mujZdroj.name, error);
          console.log('nepodařilo se načíst soubor s nabídkou pro ' + mujZdroj.name, error);
        } else {
          self[mujZdroj.parser].apply(self, [body, mojeId]);
          if (self.nabidka[mojeId].polozky.length === 0) {
            console.log('nepodařilo se zpracovat nabídku pro ' + mujZdroj.name);
          }
          resolve(self.nabidka[mojeId]);
        }
      }
    );

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
      name  : nazev.replace(/\s+/g, ' ')
        .replace(/\([\s123456789,]+\)\s?$/i, '')
        .replace(/^\d\)/i, '')
        .trim(),
      price : cena.replace(/,-\s/g, ' ').trim()
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
    if ($(this).text().toLowerCase() !== den) {
      return true; // continue
    }

    // uložíme si všechna jednotlivá jídla pro daný den
    $(this).parent().nextAll('.tmi-daily').each(function (idx, el) {
      let dirtyNazev = $(this).find('.tmi-name').text();
      let dirtyCena = $(this).find('.tmi-price').text();
      nabidkaRebe.push({
        name  : dirtyNazev.replace(/\s+/g, ' ').trim().replace(/^\d\)/i, '').trim(),
        price : dirtyCena.replace(/\s+/g, ' ').trim()
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
    if ($(this).find('td[colspan=3]').length > 0) {
      // pokud je to nadpis, tak ho přeskočíme
      return true; // continue
    } else {
      let tds = $(this).children('td').toArray()
      if ($(tds[1]).text().match(/informace\so\salergenech/i)) {
        // pokud je to závěrčné upozornění na alergeny, tak končíme
        return false;
      }
      let vaha = $(tds[0]).text().replace(/\s/g, '').trim();
      let nazev = $(tds[1]).text().replace(/\s+/g, ' ').trim();
      let cena = $(tds[2]).text();
      nabidkaPola.push({
        name  : vaha + ' ' + nazev,
        price : cena.trim()
      });
    }
  });
  this.nabidka[mojeId]['timestamp'] = Date.now();
  this.nabidka[mojeId]['polozky'] = nabidkaPola;
};


module.exports = Scraper;

// (co.*(hraj|maj|d[aá]va|je)).*(z[aá]le([zž]itost)*)