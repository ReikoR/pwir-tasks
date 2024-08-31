const database = require('./database.mjs');
const {generateDoneTasksReport} = require('./tools.mjs');

(async function () {
    await generateDoneTasksReport();

    await database.close();
})();