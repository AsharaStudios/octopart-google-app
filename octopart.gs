
function Octopart() {
  this._api = "http://octopart.com/api/v3";
  this._apikey = "a76a384c";

  this.request = function (endpoint, args, includes) {
    var url = this._api + endpoint + "?apikey=" + this._apikey;

    for (var key in args)
      url += "&" + key + "=" + encodeURIComponent(JSON.stringify(args[key]));

    if (includes) {
      for (var i = 0; i < includes.length; i++)
        url += "&" + includes[i];
    }

    var cache = CacheService.getPublicCache();
    var cached = cache.get(url);

    if (cached != null)
      return JSON.parse(cached);

    var response = UrlFetchApp.fetch(url, {method: 'get', muteHttpExceptions: true});
    if (response.getResponseCode() != 200)
      throw "something wrong... (HTTP " + response.getResponseCode() + ")";

    Logger.log('(not cached) request ' + url);
    cache.put(url, response, 60 * 60);

    return JSON.parse(response.getContentText());
  };

  this.match = function(mpn_or_sku, manuf, includes) {
    if (typeof mpn_or_sku === "undefined")
      throw "mpn or sku is required";

    var args = {};
    args.queries = [{"mpn_or_sku": mpn_or_sku, "brand": manuf}];

    return new PartsMatchResponse(this.request("/parts/match", args, includes));
  };
}

function PartsMatchResponse(response) {
  this._response = response;

  this.getResult = function(index) {
    return new PartsMatchResult(this._response.results[index]);
  }

};

function PartsMatchResult(result) {
  this._result = result;

  this.getPart = function(index) {
    if (index >= this._result.hits)
      throw "No parts found.";
    return new Part(this._result.items[index]);
  }
};

function Part(part) {
  this._part = part;

  this.getAveragePrice = function(qty, currency) {
    var sum = 0;
    var sellers = 0;

    qty = typeof qty !== "undefined"? qty: 1;
    currency = typeof currency !== "undefined"? currency: "USD";

    for (var i = 0; i < this._part.offers.length; i++) {
      var offer = new PartOffer(this._part.offers[i]);
      if (offer.hasPriceInCurrency(currency)) {
        var price = offer.getPrice(qty, currency);
        if (!isNaN(price)) {
          sum += price;
          sellers += 1;
        }
      }
    }

    return (sellers > 0? sum / sellers: 0);
  }

  this.getOffer = function(distributor, qty, currency) {
    qty = typeof qty !== "undefined"? qty: 1;
    currency = typeof currency !== "undefined"? currency: "USD";

    if (distributor) {
      for (var i = 0; i < this._part.offers.length; i++) {
        var offer = new PartOffer(this._part.offers[i]);
        if (offer.hasPriceInCurrency(currency) && offer.getSellerName() == distributor)
          return offer;
      }
    } else {
      var lowest_offer = null;

      for (var i = 0; i < this._part.offers.length; i++) {
        var new_offer = new PartOffer(this._part.offers[i]);

        if (!lowest_offer)
          lowest_offer = new_offer;
        else
          lowest_offer = new_offer.getPrice(qty, currency) < lowest_offer.getPrice(qty, currency)? new_offer: lowest_offer;
      }

      return lowest_offer;
    }

    throw "No offers found.";
  };

  this.getOctopartUrl = function() {
    return this._part.octopart_url;
  }

  this.getDatasheetUrl = function(index) {
    if (!"datasheets" in this._part || this._part.datasheets.length <= index)
      throw "No datasheets found.";

    return this._part.datasheets[0].url;
  }
};

function PartOffer(offer) {
  this._offer = offer;

  this.getPrice = function(qty, currency) {
    qty = typeof qty !== "undefined"? qty: 1;
    currency = typeof currency !== "undefined"? currency: "USD";

    if (!this.hasPriceInCurrency(currency))
      return NaN;

    var price = NaN;

    for (var i = 0; i < this._offer.prices[currency].length; i++) {
      if (this._offer.prices[currency][i][0] > qty)
        return price;

      price = this._offer.prices[currency][i][1];
    }

    return price;
  }

  this.hasPriceInCurrency = function(currency) {
    currency = typeof currency !== "undefined"? currency: "USD";
    return currency in this._offer.prices;
  }

  this.getInStockQuantity = function() {
    return this._offer.in_stock_quantity;
  }

  this.getSellerName = function() {
    return this._offer.seller.name;
  }

  this.getSellerUrl = function() {
    return this._offer.product_url;
  }

  this.getMoq = function() {
    return this._offer.moq;
  }

  this.getPackaging = function() {
    return this._offer.packaging;
  }

  this.getFactoryLeadTime = function() {
    return this._offer.factory_lead_days;
  }

  this.getOrderMultiple = function() {
    return this._offer.order_multiple;
  }

  this.getSku = function() {
    return this._offer.sku;
  }
};
