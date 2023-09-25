const database = require('./database');
const {generateDoneTasksReport} = require('./tools');

(async function () {
    await generateDoneTasksReport();

    await database.close();
})();