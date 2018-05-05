const moment = require('moment');
const _ = require('lodash');

const PromiseCache = require('@kwsites/promise-cache');

module.exports = {
   extend: 'apostrophe-widgets',
   label: 'Blog Archive',

   addFields: [
      {
         type: 'string',
         name: 'title',
         label: 'Title'
      },
      {
         name: '_page',
         type: 'joinByOne',
         withType: 'apostrophe-page',
         label: 'Page',
         required: true,
         idField: 'pageId',
         filters: {
            projection: {
               slug: 1,
               title: 1
            }
         }
      }
   ],

   construct (self, options) {
      const cache = new PromiseCache(PromiseCache.FIVE_MINUTES);

      self.blog = self.apos.modules[options.moduleName || 'blog'];

      self.pushAssets = _.wrap(self.pushAssets, (superFn) => {
         self.pushAsset('stylesheet', 'always', { when: 'always', data: true });
         _.attempt(superFn);
      });

      self.load = _.wrap(self.load, (superFn, req, widgets, callback) => {
         const loaders = widgets.map(async (widget) => {
            try {
               widget._archive = await loader(cache, req, self.blog);
            }
            catch (e) {
               widget._archive = [];
            }
         });

         Promise.all(loaders)
            .then(() => superFn(req, widgets, callback))
            .catch((err) => callback(err));

      });
   }
};

function loader (cache, req, mod) {
   return cache.get('loader') || cache.set('loader', new Promise((ok, fail) => {
      mod.find(req, {}, { publishedAt: 1 }).toDistinct('publishedAt', (err, results) => {

         if (err) {
            return fail(err);
         }

         ok( _.uniq(results.map(date => date.substr(0, 7)))
            .sort().reverse()
            .map(toArchiveItem));
      });

   }));
}

function toArchiveItem (yearAndMonth) {
   const m = moment(yearAndMonth, 'YYYY-MM');
   return {
      year: m.year(),
      month: m.format('MMMM'),
      path: m.format('YYYY/MM'),
      value: yearAndMonth
   }
}
