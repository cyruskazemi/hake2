/* shovelnose.js - pass item(s) to amazon */

var Nm     = require('nightmare'),
    nm     = new Nm({ loadImages : false }),
    //-------------
    _      = require('underscore'),
    Q      = require('q'),
    //-------------
    Loach  = require('./loach.js'),
    loach  = new Loach(),
    //-------------
    common = require('./common.js'),
    dbg    = new common.Debug('shovelnose.js'),
    //-------------
    first  = true, items, i; // function specific variables

function _firstResultIsVideoContainer (item, pr) {
    return pr.textContent.trimLeft().substr(0,(26 + item.name.length))
            === 'Video shorts related to "' + item.name + '"';
}

function search(item, searchq)
{
    dbg.freg = 'search';

    if (first)
        var searchq = Q.defer();

    if (item !== undefined) {
        nm
        .useragent('Mozilla/5.0 (X11; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0') // ensure no mobile page
        .goto('http://www.amazon.com')
        .type('input[id="twotabsearchtextbox"]', item.name)
        .click('input[value="Go"]')
        .wait("#atfResults")
        .evaluate(function(item, searchq) {
            if (document.querySelector('#noResultsTitle')) { // item not found
                return null;
            }

            /* get first result*/
            var pr = document.querySelector('#s-results-list-atf').childNodes[0],
                asin;
            if (_firstResultIsVideoContainer(item, pr)) {
                pr = pr.parentNode.childNodes[1]; // first result was video container, skip it
            }
            asin = pr.getAttribute('data-asin') || '';

            return asin;
        }, function(ret) {
               if (ret) {
                   dbg.log('search for item: `' + item.name + '\' successful');
                   item.asin = ret;
                   return;
               }
               dbg.log('search for item: `' + item.name + '\' unsuccessful');
               items[items.indexOf(item)] = null;
               return ;
        }, item)
        .run(function(err, nm) {
            if (err) {
                dbg.log(err);
                throw err;
            }

            if (item.asin) {
                /* search was successful, continue to individual page */
                nm
                .useragent('Mozilla/5.0 (X11; Linux x86_64; rv:37.0) Gecko/20100101 Firefox/37.0') // ensure no mobile page
                .goto('http://www.amazon.com/dp/' + item.asin)
                .wait('#productTitle')
                .evaluate(function(item) {
                    var productHasNewFormat = false,
                        retobj = {};

                    // get name
                    var name = document.querySelector('#productTitle')
                            || document.querySelector('#btAsinTitle')
                            || null;

                    if(name) {
                        retobj.AMZname = name.textContent;
                    } else {
                        return 'failed at name query';
                    }

                    // get price
                    var price = document.querySelector('#priceblock_ourprice') // regular format
                        || document.querySelector('#priceblock_saleprice') // sale
                        || document.querySelector('#actualPriceValue') // large price
                        || null;

                    if(price) {
                        price = parseFloat("" + price.textContent.replace('$', ''));
                        retobj.AMZprice = price;
                    } else {
                        return 'failed at price query';
                    }

                    if ((price / item.price) >= 3) { // good, get rest of info

                        // Get details
                        var details = document.querySelector('#detail-bullets'),
                            rank;
                        if (!details) {
                            details = document.querySelector('#prodDetails'); // new product format
                            if (!details) {
                                return 'failed at detail query';
                            }
                            productHasNewFormat = true;
                        }

                        // Get rank
                        rank = details.querySelector('#SalesRank').textContent || "999,999,999";
                        rank = parseInt(rank.match(/\d{1,3}(,\d{3})*(\.\d+)?/)[0].replace(/,/g,''));

                        if (rankranking < 50000)
                            retobj.AMZrankIs = 'ideal';
                        else if (rankranking < 100000)
                            retobj.AMZrankIs = 'good';
                        else if (rankranking < 200000)
                            retobj.AMZrankIs = 'fair';
                        else
                           return 'toss'; // toss it
                    } else {
                        return 'failed at price division';
                    }

                    if (productHasNewFormat) {
                        var details = details.getElementsByClassName('label');
                        if (!details) {
                            return 'failed to get labels';
                        }
                        retobj.AMZdimensions = '';
                        for (var i = 0; i < details.length; i++) {
                            switch (details[i].textContent) {
                                case "Product Dimensions" :
                                    retobj.AMZdimensions = details[i].parentNode.querySelector('td.value').textContent;
                                    break;
                                case "UPC" :
                                    retobj.AMZupc = details[i].parentNode.querySelector('td.value').textContent;
                                    break;
                                case "Shipping Weight" :
                                    var val = details[i].parentNode.querySelector('td.value').textContent;
                                    val = ' ' + details[i].textContent + ' ' + val.replace(/\(.*\)/, '').trimRight();
                                    retobj.AMZdimensions += val;
                                    break;
                                default :
                                    // ???
                                    break;
                            }
                        }
                        if (!retobj.AMZdimensions) {
                            return 'failed to get dimensions in product table';
                        }
                        return retobj;
                    } else {
                        // Product has old format
                        var dimensions = details.getElementsByTagName('li');
                        if (dimensions) {
                            for (var i = 0; i < dimensions.length; i++) {
                                if (dimensions[i].textContent.match('Product Dimensions:')) {
                                    retobj.AMZdimensions = /\d.+/.exec(dimensions[i].textContent)[0]
                                    return retobj;
                                }
                                else if (dimensions[i].textContent.match('Shipping Weight')) {
                                    retobj.AMZdimensions += /^.*\d+ \w+/.exec(dimensions[i].textContent)[0];
                                    return retobj;
                                }
                            }
                        }
                    }
                    return 'fails at end';
                }, function(determiner) {
                    if (determiner) {
                        if (determiner === 'toss') {
                            items[items.indexOf(item)] = null;
                            item = null;
                            return item;
                        }
                        else if (typeof determiner === 'string') {
                            dbg.log('`' + item.name + "'" + ' nightmare .eval', determiner, true);
                            items[items.indexOf(item)] = null;
                            return item = null;
                        }
                        detkeys = Object.keys(determiner);
                        for (var i = 0; i < detkeys.length; i++) {
                            item[detkeys[i]] = determiner[detkeys[i]];
                        }
                        return determiner;
                    }
                    dbg.log('failed to get info of item `' + item.name + "'");
                    if(items.indexOf(item) > -1) {
                        items[items.indexOf(item)] = null;
                    }
                    item = null;
                    return item;
                }, item)
                .run(function(err, nm) {
                    if (err)
                        throw err;
                    if (item) dbg.log('successfully processed item: `' + item.name + "'");
                    /* find subsequent items recursively */
                    var next;
                    if (next = process_next())
                        return search(next, searchq);
                    searchq.resolve(JSON.stringify(items));
                });
                return;
            }
            /* add recursion outside of if blk in case last item's search is unsuccessful */
            var next = process_next();
            if (next) {
                return search(next, searchq);
            }
            searchq.resolve(JSON.stringify(items));
       });
       if (first) {
           first = !first;
           return searchq.promise;
       } else {
            return false;
       }
    } else {
          dbg.log('loach returned NULL');
          return searchq.resolve(null);
    }
}

function process_next(init)
{
    if (init) {
        var promises = [];
        items = init, i = 0,
        promises.push(search(items[i]));
        return Q.all(promises);
    }
    if (!items[i]) {
        items.splice(i, 1);
        return items[i] ? items[i] : null;
    }
    return items[++i] ? items[i] : null;
}

// Loach's getResults
/*
function getResults () {
    _.each(sitesJSON, function (site) {
        _.each(site.departments, function (dept, index) {
            promises.push(scrape(site, index));
        });
    });

    return Q.all(promises);
}
*/

function getResults () {
    loach.getResults().then(function(results) {
        var results = _.flatten(results);
        console.log(results);

        search(results[0]);
        return process_next(res);
    });
}

getResults();

module.exports = function () {
    return {
        getResults : getResults
    }
}
