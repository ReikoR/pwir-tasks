const database = require('./database');
const {generateAllSVGs} = require('./tools');

(async function () {
    await generateAllSVGs();

    await database.close();
})();
