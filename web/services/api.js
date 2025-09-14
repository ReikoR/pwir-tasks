async function request(url, options) {
    return await fetch(url, options).then(async (response) => {
        const contentType = response.headers.get('Content-Type');

        if (contentType) {
            if (contentType.includes('json')) {
                if (response.ok) {
                    return response.json();
                }

                throw await response.json();
            } else if (contentType.includes('octet-stream')) {
                if (response.ok) {
                    return response.arrayBuffer();
                }

                throw response.status;
            }
        }

        if (response.ok) {
            return response.text();
        }

        throw await response.text();
    }).catch((errorInfo) => {
        console.error(errorInfo);

        throw errorInfo;
    });
}

async function get(url) {
    return request(url, {
        credentials: 'include',
    });
}

async function post(url, params) {
    return request(url, {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(params)
    });
}

export function getSession() {
    return get('/session');
}

export function login(username, password) {
    return post('/login', {username, password});
}

export function logout() {
    return get('/logout');
}

export function getTasks() {
    return get('/api/tasks');
}

export function getTeams() {
    return get('/api/teams');
}

export function getTeamsAndPoints() {
    return get('/api/teams-and-points');
}

export function getParticipants(params) {
    return post('/api/participants', params);
}

export function getParticipantsAndPoints() {
    return get('/api/participants-and-points');
}

export function getCompletedTasksList() {
    return get('/api/completed-tasks-list');
}

export function getCompletedTask(task_id, team_id) {
    return post('/api/get-completed-task', {task_id, team_id});
}

export function setCompletedTask(params) {
    return post('/api/set-completed-task', params);
}

export function getPointsUsedByTaskParticipant(params) {
    return post('/api/get-participant-points-used', params);
}

export function getParticipantTaskPoints(params) {
    return post('/api/get-participant-task-points', params);
}

export function getCompletedTaskChanges(params) {
    return post('/api/get-completed-task-changes', params);
}

export function getReviewInputInfo() {
    return get('/api/review-input-info');
}

export function getReviewList(params) {
    return post('/api/review-list', params);
}

export function createReview(params) {
    return post('/api/create-review', params);
}

export function updateReview(params) {
    return post('/api/update-review', params);
}

export function updateReviewChangesCompleted(params) {
    return post('/api/update-review-changes-completed', params);
}

export function getReviewChanges(params) {
    return post('/api/get-review-changes', params);
}

export function getConfig() {
    return get('/api/config');
}