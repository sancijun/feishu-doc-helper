
// 监听消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log('background onMessage: ', msg);
    let tabId: number | undefined;
    if (sender && sender.tab) tabId = sender.tab.id;
    switch (msg.type) {
        case 'getCookies':
            getCookies(msg.fieldName, msg.url).then((content) => {
                sendResponse({ fieldValue: content });
            });
            return true;
        case 'fetch':
            if (!msg.url) return;
            fetch(msg.url, msg.init).then(resp => {
                console.log('resp', resp);
                let contentType = msg.init.headers['content-type'];
                if (contentType === undefined || contentType === 'application/json')
                    return resp.json();
                else if (contentType === 'text/plain')
                    return resp.text();
            }).then(data => {
                sendResponse({ data: data });
            });
            break;
    }
    return true;
});

// Send message to content script
async function sendMessage(sendMsg: { tabId?: number; message: any; }) {
    return new Promise((res, rej) => {
        let callbackHandler = (response: any) => {
            if (chrome.runtime.lastError) return rej();
            if (response) return res(response);
        }

        if (sendMsg.tabId != undefined) {
            chrome.tabs.sendMessage(sendMsg.tabId, sendMsg.message, callbackHandler);
        } else {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0]) return rej();
                chrome.tabs.sendMessage(tabs[0].id!, sendMsg.message, callbackHandler);
            });
        }
    }).catch((error) => { console.log(error); });
}

async function getLocalStorageData(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            resolve(result[key]);
        });
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCookies(fieldName: string, url: string): Promise<string | null> {
    return new Promise((resolve) => {
        chrome.cookies.get({ name: fieldName, url: url }, (cookie) => {
            const fieldValue = cookie ? cookie.value : null;
            resolve(fieldValue);
        });
    });
}