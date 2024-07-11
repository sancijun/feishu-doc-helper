
import type { PlasmoCSConfig } from 'plasmo';
import { v4 as uuidv4 } from 'uuid';

export const config: PlasmoCSConfig = {
    matches: ["https://*.feishu.cn/drive/*"],
    run_at: "document_idle"
}

// 初始化消息监听
function initMessageListener() {
    console.log('initMessageListener');
    // 监听 service worker 消息
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
        if (msg.alert) {
            message.error(msg.alert, 10);
            sendResponse({ succ: 1 });
        } else if (msg.content) {
            copy(msg.content);
        }
    });
}

async function loadAllFileList() {
    console.log('loadAllFileList');
    const currentTime = new Date().getTime();
    const lastLoadTime = await getLocalStorageData('lastLoadTime') as number;
    const lastHostName = await getLocalStorageData('lastHostName') as string;
    console.log(currentTime, lastLoadTime, lastHostName)
    if (lastLoadTime && (currentTime - lastLoadTime < 30 * 60 * 1000)
        && lastHostName && lastHostName == window.location.hostname) {
        console.log('loadAllFileList skip');
        return;
    }
    const fileList = [];
    const folderList = [];

    const mySpaceFolder = await fetchFolders()
    const shareSpaceFolder = await fetchShareFolders();
    const allFolder = new Set([...mySpaceFolder.node_list, ...shareSpaceFolder.node_list]);
    console.log("mySpaceFolder", mySpaceFolder, "shareSpaceFolder", shareSpaceFolder, "allFolder", allFolder);
    for (const token of allFolder) {
        const folder = mySpaceFolder.entities.nodes[token] || shareSpaceFolder.entities.nodes[token];
        folderList.push({ path: folder.name, token: folder.token });
        await getFileList(token, folder.name, fileList, folderList);
    }
    await getFileList('', '我的空间', fileList, folderList);
    folderList.push({ path: '我的空间', token: '' });
    console.log("load result, fileList", fileList, "folderList", folderList);
    chrome.storage.local.set({ 'lastLoadTime': new Date().getTime() });
    chrome.storage.local.set({ 'lastHostName': window.location.hostname });
    chrome.storage.local.set({ 'feishuFileList': fileList });
    chrome.storage.local.set({ 'feishuFolderList': folderList });
}

async function getFileList(token: string, folder_path: string, fileList: [], folderList: []) {

    const ret = token ? await fetchChildrenList(token) : await fetchMySpaceFileList();

    for (const nodeId of ret.data.node_list) {
        const node = ret.data.entities.nodes[nodeId];
        if (node.token != token && node.type == 0) {
            await getFileList(node.token, `${folder_path}/${node.name}`, fileList, folderList);
            let path = `${folder_path}/${node.name}`;
            folderList.push({ path: path, token: node.token });
        } else if (node.token != token && node.type != 0) {
            let url_parts = node.url.split('/');
            let type = url_parts[url_parts.length - 2]
            if (type == 'base') {
                node.obj_type = 'bitable'
            } else if (type == 'sheets') {
                node.obj_type = 'sheet'
            } else {
                node.obj_type = type
            }
            node.folder_path = folder_path;
            fileList.push(node);
        }
    }
}

async function fetchFolders() {
    await sleep(500);
    const json = await getJson(`${window.location.origin}/space/api/explorer/v3/my_space/folder/?asc=1&rank=5&length=50`);
    return json.data;
}

async function fetchShareFolders() {
    await sleep(500);
    const json = await getJson(`${window.location.origin}/space/api/explorer/v2/share/folder/list/?asc=0&rank=3&hidden=0&length=50`);
    return json.data;
}

async function fetchChildrenList(token: string) {
    await sleep(500);
    return await getJson(`${window.location.origin}/space/api/explorer/v3/children/list/?asc=1&rank=5&token=${token}`);
}

async function fetchMySpaceFileList() {
    await sleep(500);
    return await getJson(`${window.location.origin}/space/api/explorer/v3/my_space/obj/`);
}

async function createExportTask(data: {}, url: string, type: string) {
    try {
        await sleep(500);
        const requestId = 'bbAtOlQGYEbs-' + uuidv4().replace(/-/g, '');
        let resp = await fetch(`${window.location.origin}/space/api/export/create/?synced_block_host_token=${data.token}&synced_block_host_type=${type}`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "zh-CN,zh;q=0.9",
                "content-type": "application/json",
                "context": `${requestId};os=mac;app_version=1.0.13.3784;os_version=10.15.7;platform=web`,
                "doc-biz": "Lark",
                "pragma": "no-cache",
                "request-id": requestId,
                "rpc-persist-lane-c-lark-uid": "0",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-csrftoken": await getCookies('_csrf_token'),
                "x-request-id": requestId,
                "x-tt-trace-id": requestId
            },
            "referrer": url,
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": JSON.stringify(data),
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        });
        let json = await resp.json();
        console.log('resp', json);
        return json;
    } catch (error) {
        console.log('error', error);
        return null;
    }
}

async function waitForExportResult(ticket: string, token: string, obj_type: string, type: string) {
    let file_token;
    for (let retryCount = 0; retryCount < 15 && !file_token; retryCount++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const resp = await fetchExportResult(ticket, token, obj_type, type);
        file_token = resp?.data?.result?.file_token;
    }

    return file_token;
}

async function fetchExportResult(ticket: string, token: string, obj_type: string, type: string) {
    await sleep(500);
    if (!ticket) {

    }
    return await getJson(`${window.location.origin}/space/api/export/result/${ticket}?token=${token}&type=${obj_type}&synced_block_host_token=${token}&synced_block_host_type=${type}`);
}

async function download(file_token: string, token: string, type: string) {
    await sleep(500);
    return await fetch(`https://internal-api-drive-stream.feishu.cn/space/api/box/stream/download/all/${file_token}/?synced_block_host_token=${token}&synced_block_host_type=${type}`, {
        "headers": {},
        "body": null,
        "method": "GET",
        "mode": "cors",
        "credentials": "include"
    });

}

async function getJson(url: string) {
    try {
        let resp = await fetch(url, {
            credentials: "include",
            cache: 'no-cache'
        });
        let json = await resp.json();
        return json;
    } catch (error) {
        console.log('error', error, 'url', url);
        return null;
    }
}

/* 复制文本内容 */
async function copy(targetText: string): Promise<void> {
    try {
        // console.log('copy', targetText);
        await navigator.clipboard.writeText(targetText);
    } catch (err) {
        console.log('Failed to copy: ', err);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/* 模拟点击 */
function simulateClick(element: HTMLElement, init = {}): void {
    const clientRect = element.getBoundingClientRect();
    const clientX = clientRect.left;
    const clientY = clientRect.top;
    const position = { clientX: clientX, clientY: clientY };
    Object.assign(init, position);
    let mouseEvent = new MouseEvent("click", init);
    element.dispatchEvent(mouseEvent);
}

async function getLocalStorageData(key) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            resolve(result[key]);
        });
    });
}

function getCurrentTimestamp(): string {
    const now = new Date();

    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const milliseconds = now.getMilliseconds().toString().padStart(3, '0');

    const formattedTimestamp = `${year}${month}${day}${hours}${minutes}${seconds}${milliseconds}`;
    return formattedTimestamp;
}

async function getCookies(fieldName: string): Promise<string | null> {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getCookies', fieldName: fieldName, url: window.location.href }, function (resp) {
            console.log(fieldName, resp.fieldValue)
            resolve(resp.fieldValue);
        });
    });
}

function cascaderData(data: []) {
    const options: any[] = [];
    options.push({label: '全部导出', value: '全部导出'})
    data.forEach((item) => {
        const pathSegments = item.path.split('/');
        let currentOptions = options;

        pathSegments.forEach((segment, index) => {
            const existingOption = currentOptions.find((option) => option.label === segment);

            if (!existingOption) {
                const newOption = { label: segment, value: index === pathSegments.length - 1 ? item.path : '', children: [] };
                currentOptions.push(newOption);
                currentOptions = newOption.children;
            } else {
                currentOptions = existingOption.children;
            }
        });
    });
    console.log("options", options)
    return options;
};

export { loadAllFileList, createExportTask, waitForExportResult, download, copy, sleep, simulateClick, getLocalStorageData, getCurrentTimestamp, getCookies, cascaderData };