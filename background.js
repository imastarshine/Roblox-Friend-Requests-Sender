let lastStatus = "";
let progressCurrentUser = 0;
let progressMaxUser = 0;
let delayTime = 10000;
let senderName = "";

let xCsrfToken = "";

let shouldStop = false;
let working = false;

let controller = new AbortController();

function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        const id = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => {
            clearTimeout(id);
            reject(new Error("Sleep aborted"));
        });
    });
}

function abortController() {
    if (controller) {
        controller.abort();
        controller = new AbortController();
    }
}

function setStatus(status) {
    lastStatus = status;
    console.log(`Status: ${status}`);
    chrome.runtime.sendMessage({
        action: "update_status",
        status: status
    });
}

function updateProgress() {
    chrome.runtime.sendMessage({
        action: "update_progress",
        progress: progressCurrentUser,
        max: progressMaxUser
    });
}

async function getCsrfToken() {
    if (shouldStop) throw new Error("Operation cancelled");

    let token = "";
    try {
        const response = await fetch('https://friends.roblox.com/v1/users/1/request-friendship', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (shouldStop) throw new Error("Operation cancelled");
        token = response.headers.get('x-csrf-token');
        if (!token) {
            throw new Error("Failed to get CSRF token");
        }
    } catch (error) {
        console.log(`Error getting CSRF token: ${error.message}`);
        // TODO: here call a event for stop
        throw error;
    }
    return token;
}

async function sendFriendRequest(userId, userInfo, token) {
    if (shouldStop) throw new Error('Operation cancelled');
    const url = `https://friends.roblox.com/v1/users/${userId}/request-friendship`;
    const payload = {friendshipOriginSourceType: "UserProfile"};

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': token
            },
            credentials: 'include',
            body: JSON.stringify(payload)
        });

        let data = null;

        try {
            data = await response.json();
        } catch (_) {}

        if (shouldStop) throw new Error('Operation cancelled');
        if (response.status === 403) throw new Error('Token expired');

        if (response.status !== 200) return { success: false, code: response.status, message: response.statusText, data: data };

        console.log(`Friend request status: ${response.status}`);
        console.log(`Friend request data: ${JSON.stringify(data)}`);
        return { success: true, data: data, response: response };
    } catch (error) {
        if (error.message === "Operation cancelled") {
            return { success: false, error: 'Operation cancelled' };
        }
        return { success: false, error: error.message };
    }
}

async function start(usersJSON) {
    const users = JSON.parse(usersJSON);

    working = true;
    let token = "";
    const userIds = Object.keys(users);
    progressMaxUser = userIds.length;
    progressCurrentUser = 0;
    let i = 0;

    try {
        setStatus("Getting CSRF token");
        token = await getCsrfToken();
    } catch (error) {
        console.log(`Error getting CSRF token: ${error.message}`);
        setStatus(`An error occurred on getting CSRF token: ${error.message}`);
        chrome.runtime.sendMessage({ action: "stop_script" });
        working = false;
        return;
    }

    for (const userId of userIds) {
        if (shouldStop) {
            setStatus(`Stopped by user`);
            chrome.runtime.sendMessage({ action: "stop_script" });
            working = false;
            break;
        }
        //TODO: add status change

        const userInfo = users[userId];
        
        setStatus(`Sending friend request to ${userInfo.displayName} (@${userInfo.username} ID:${userId})`);
        let attempt = 0;
        let result;
        while (working) {
            result = await sendFriendRequest(userId, userInfo, token);
            if (result && (result.response?.status === 403 || result.error === "Token expired")) {
                try {
                    token = await getCsrfToken();
                } catch (error) {
                    setStatus(`Error on getting CSRF token: ${error.message}`);
                    chrome.runtime.sendMessage({ action: "stop_script" });
                    console.log(`Something went wrong on updating token: ${error.message}`);
                    working = false;
                    break;
                }
            } else if (result?.response?.status === 429) {
                setStatus(`Rate limit. Waiting 30s... Attempt ${attempt}/10`);
                try {
                    await sleep(30000, controller.signal);
                } catch {
                    setStatus("Stopped during wait");
                    break;
                }
            } else {
                break;
            }
            attempt++;
            if (attempt >= 10) {
                setStatus("Too many retries. Giving up");
            }
        }
        
        if (working === false) break;

        if (result.success) {
            setStatus(`✓ Sended friend request to ${userInfo.displayName} (@${userInfo.username} ID:${userId})`);
        } else {
            // TODO:
            if (result.error === "Operation cancelled") {
                setStatus(`Stopped by user`);
                chrome.runtime.sendMessage({ action: "stop_script" });
                working = false;
                break;
            }

            if (result.success === false && result.code) {
                try {
                    console.log(`result: ${JSON.stringify(result)}`);
                    let errorMsg = result.data.errors[0].message;
                    console.log(`error message: ${errorMsg}`);
                    setStatus(`✗ Error on sending friend request to ${userInfo.displayName} (@${userInfo.username} ID:${userId}) - ${result.code} - ${errorMsg}`);
                } catch (error) {
                    setStatus(`✗ Error on sending friend request to ${userInfo.displayName} (@${userInfo.username} ID:${userId}) - ${result.code} - ${result.message}`);
                }
            } else {
                setStatus(`✗ Error on sending friend request to ${userInfo.displayName} (@${userInfo.username} ID:${userId}) - ${result.error}`);
            }
        }
        progressCurrentUser++;
        updateProgress();
        
        if (shouldStop) break;

        if (!shouldStop && i < userIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayTime));
        }
        i++;
    }

    abortController();

    if (shouldStop) {
        setStatus(`Stopped by user`);
    } else {
        setStatus(`Sended ${userIds.length} friend requests`);
    }

    chrome.runtime.sendMessage({ action: "stop_script" });

    shouldStop = false;
    working = false;
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "get_status") {
        console.log("Got request for get status")
        sendResponse({ 
            status: lastStatus,
            progressCurrentUser: progressCurrentUser,
            progressMaxUser: progressMaxUser,
            working: working
        });
        return;
    } else if (request.action === "start" ) {
        shouldStop = false;
        delayTime = request.delayValue;
        start(request.jsonContent);
        sendResponse({ ok: true });
        return true;
    } else if (request.action === "stop") {
        shouldStop = true;
        working = false;
        progressCurrentUser = 0;
        progressMaxUser = 0;
        abortController();
        // TODO:
        sendResponse({ ok: true });
        return true;
    } else if (request.action === "set_data") {
        if (request.data.senderName) {
            senderName = request.data.senderName;
        }
        if (request.data.delayTime) {
            delayTime = request.data.delayTime;
        }
        sendResponse({ ok: true });
        return true;
    }

    return true;
})