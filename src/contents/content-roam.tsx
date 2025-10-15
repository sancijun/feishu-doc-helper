import React, { useEffect } from 'react';
import { Button, Tooltip } from 'antd';
import type { PlasmoCSConfig } from 'plasmo';
import '../styles/content-menu.css';
import { sleep, getLocalStorageData } from '../utils/common';
import type { FeishuFile } from '../types/feishu';

import { analytics } from '../utils/baidu-analytics';

/**
 * Plasmo 内容脚本配置
 */
export const config: PlasmoCSConfig = {
    matches: ["https://*.feishu.cn/*"],
    run_at: "document_start"
};

/**
 * 获取根容器，用于挂载 React 组件
 * @returns {Promise<HTMLElement>} 返回一个 Promise，解析为挂载点元素
 */
export const getRootContainer = async () => {
    let referenceElement;
    // 尝试多次查找挂载点
    for (let retryCount = 0; retryCount < 50 && !referenceElement; retryCount++) {
        await sleep(500)
        referenceElement = document.querySelector('.new-notice-wrapper') || document.querySelector('.suite-notice-center');
        console.log('getRootContainer: 查找挂载点', referenceElement);
    }
    const menuContainer = document.createElement('div');
    // 将挂载点插入到参考元素之前
    referenceElement.insertAdjacentElement('beforebegin', menuContainer);
    return menuContainer;
};

/**
 * 文档漫游图标
 * @constructor
 */
const RoamSvg = () => (
    <svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1462" width="200" height="200"><path d="M172.18370333 172.18370333v679.63259334h679.63259334V172.18370333H172.18370333zM75.09333333 172.18370333a97.09036999 97.09036999 0 0 1 97.09037-97.09037h679.63259334a97.09036999 97.09036999 0 0 1 97.09037 97.09037v679.63259334a97.09036999 97.09036999 0 0 1-97.09037 97.09037H172.18370333a97.09036999 97.09036999 0 0 1-97.09037-97.09037V172.18370333z m606.81481444 582.54222222a72.81777778 72.81777778 0 1 0 0-145.63555556 72.81777778 72.81777778 0 0 0 0 145.63555556zM414.90963001 342.09185223a72.81777778 72.81777778 0 1 1-145.63555556 0 72.81777778 72.81777778 0 0 1 145.63555556 0z m97.09036999 242.72592555a72.81777778 72.81777778 0 1 0 0-145.63555556 72.81777778 72.81777778 0 0 0 0 145.63555556z" fill="#646a73" p-id="1463"></path></svg>
);

/**
 * 文档漫游组件
 * @constructor
 */
const Roam: React.FC = () => {

    useEffect(() => {
        // 组件挂载时可以执行一些初始化操作
    }, []);

    /**
     * 随机漫游到一个文档
     */
    async function onRoamAround() {
        console.log('onRoamAround: 开始文档漫游');
        analytics.trackPageView('/roam', '文档漫游');

        try {
            const fileList = await getLocalStorageData('feishuFileList') as FeishuFile[];
            const roamExcludeFolder = await getLocalStorageData('roamExcludeFolder') as string[] || [];
            console.log('onRoamAround: 获取到文件列表和排除文件夹列表', { fileList, roamExcludeFolder });

            if (!fileList || fileList.length === 0) {
                console.warn('onRoamAround: 文件列表为空，无法漫游');
                return;
            }

            const roamExcludeFolderList = roamExcludeFolder.map((item) => item[item.length - 1]);
            let filteredFileList = fileList.filter(file => {
                return !roamExcludeFolderList.some(excludeFolder => file.path.includes(excludeFolder));
            });
            console.log('onRoamAround: 过滤后的文件列表', filteredFileList);

            if (filteredFileList.length === 0) {
                console.warn('onRoamAround: 过滤后文件列表为空，无法漫游');
                return;
            }

            const randomIndex = Math.floor(Math.random() * filteredFileList.length);
            const randomFile = filteredFileList[randomIndex];
            console.log('onRoamAround: 随机选择的文件', randomFile);

            if (randomFile && randomFile.url) {
                window.open(randomFile.url, '_self');
            } else {
                console.error('onRoamAround: 无法获取随机文件的链接', randomFile);
            }
        } catch (error) {
            analytics.trackError('文档漫游时发生错误');
            console.error('onRoamAround: 文档漫游时发生错误', error);
        }
    }

    return (
        <Tooltip placement="bottom" title='文档漫游'>
            <Button 
                type="text" 
                onClick={() => onRoamAround()} 
                icon={<RoamSvg />} 
                style={{ marginLeft: '10px' }} 
            />
        </Tooltip>
    )
}

export default Roam;
