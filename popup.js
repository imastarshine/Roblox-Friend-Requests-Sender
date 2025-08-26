const jsonInput = document.getElementById('json-input');
const delayInput = document.getElementById('delay-input');
const statusItem = document.getElementById('status');
const progressBar = document.getElementById("progress-bar");
const progressTitle = document.getElementById("progress-title");
const startButton = document.getElementById('start-button');

let sendStop = false;

function fetchStatusFromBackground(callback) {
    chrome.runtime.sendMessage({ action: "get_status" }, function (response) {
        if (!response) {
            console.error("No response received from background script.");
            return;
        }
        console.log(`get_status: ${JSON.stringify(response)}`);
        if (response.status !== undefined) {
            statusItem.textContent = `Status: ${response.status}`;
        }
        if (response.progressCurrentUser !== undefined && response.progressMaxUser !== undefined) {
            progressBar.style.width = `${(response.progressCurrentUser / response.progressMaxUser) * 100}%`;
            progressTitle.textContent = `Progress: ${response.progressCurrentUser} / ${response.progressMaxUser}`;
        }
        callback(response);
    });
}

document.addEventListener('DOMContentLoaded', function () {
    chrome.storage.local.get(['jsonContent', 'delayValue'], function (result) {
        if (result.jsonContent) {
            jsonInput.value = result.jsonContent;
            try {
                JSON.parse(jsonInput.value);
            } catch (error) {
                if (jsonInput.classList.contains('json-valid')) {
                    jsonInput.classList.remove('json-valid');
                }
                jsonInput.classList.add('json-invalid');
            }
        }
        if (result.delayValue) {
            delayInput.value = result.delayValue;
        }
    });

    fetchStatusFromBackground(function (response) {
        console.log(`Fetched scriptStatus from background.js: ${response}`);
        if (response) {
            if (response.working === true) {
                if (!startButton.classList.contains('stop')) {
                    startButton.classList.add("stop");
                }
                startButton.textContent = "Stop";
            } else {
                if (startButton.classList.contains('stop')) {
                    startButton.classList.remove('stop');
                }
                startButton.textContent = "Start";
            }
        }
    });
});

jsonInput.addEventListener('input', function () {
    chrome.storage.local.set({ jsonContent: jsonInput.value }, function () {
        console.log('Json Saved:', jsonInput.value);
    });

    try {
        JSON.parse(jsonInput.value);
        jsonInput.classList.remove('json-invalid');
        jsonInput.classList.add('json-valid');
    } catch (error) {
        jsonInput.classList.remove('json-valid');
        jsonInput.classList.add('json-invalid');
    }
});

delayInput.addEventListener('input', function () {
    chrome.storage.local.set({ delayValue: parseInt(delayInput.value, 10) }, function () {
        console.log('Delay saved:', delayInput.value);
    });
});

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "update_status") {
        statusItem.textContent = `Status: ${request.status}`;
    } else if (request.action === "stop_script") {
        sendStop = false;
        if (startButton.classList.contains('stop')) {
            startButton.classList.remove('stop');
        }
        startButton.textContent = "Start";
        progressBar.style.width = "0%";
        progressTitle.textContent = `Progress: 0 / 0`;
        // TODO: progress bar
    } else if (request.action === "update_progress") {
        let progressCurrentUser = request.progress;
        let progressMaxUser = request.max;
        progressTitle.textContent = `Progress: ${progressCurrentUser} / ${progressMaxUser}`;
        progressBar.style.width = `${(progressCurrentUser / progressMaxUser) * 100}%`;
    }
})

let isProcessing = false;
startButton.addEventListener('click', function () {
   if (isProcessing) return;
    isProcessing = true;

    try {
        JSON.parse(jsonInput.value);
    } catch (error) {
        alert("Неверный формат JSON");
        return;
    }

    setTimeout(() => {
        isProcessing = false;
    }, 3500);

    fetchStatusFromBackground(function (response) {
        if (response) {
            if (sendStop) {
                return;
            }
            if (response.working === true) {
                
                chrome.runtime.sendMessage({ action: "stop" });
                sendStop = true;
                startButton.textContent = "Stopping";
            } else {
                chrome.runtime.sendMessage({
                    action: "start",
                    jsonContent: jsonInput.value,
                    delayValue: parseInt(delayInput.value, 10)
                });
                if (!startButton.classList.contains('stop')) {
                    startButton.classList.add("stop");
                }
                startButton.textContent = "Stop";
            }
        }
    });
})
