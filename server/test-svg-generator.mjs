const database = require('./database.mjs');
const {generateAllSVGs} = require('./tools.mjs');

(async function () {
    await generateAllSVGs();

    await database.close();
})();
