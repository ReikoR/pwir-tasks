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
    return request(url);
}

export async function post(url, params) {
    return request(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(params)
    });
}

export function isNonEmptyArray(potentialArray) {
    return Array.isArray(potentialArray) && potentialArray.length > 0;
}