const database = require('./database');
const {generateSVGs} = require('./svg-generator');

async function generateAllSVGs() {
    const teams = await database.getTeams();

    await generateSVGsInternal(teams);
}

async function generateTeamSVGs(teamId) {
    const teams = (await database.getTeams()).filter(t => t.team_id === teamId);

    await generateSVGsInternal(teams, false);
}

async function generateSVGsInternal(teams, shouldGenerateDateScale = true) {
    const tasks = await database.getTasks();
    const completedTasksList = await database.getCompletedTasksOverview();

    await generateSVGs(teams, tasks, completedTasksList, shouldGenerateDateScale);
}

module.exports = {
    generateAllSVGs,
    generateTeamSVGs
}

